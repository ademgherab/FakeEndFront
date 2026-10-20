using MockApi.Core.Configuration;
using MockApi.Core.Errors;
using MockApi.Core.Generation;
using MockApi.Core.Schemas;

namespace MockApi.Core.Settings;

/// <summary>
/// Applies endpoint-settings defaults, validates every rule from technical spec §8.2, performs the
/// save-time cross-checks from §8.3, and returns a fully resolved settings object plus the plan the
/// preview/runtime need. All failures are <see cref="ApiException"/>s so controllers stay thin.
/// </summary>
public static class EndpointSettingsService
{
    private static readonly HashSet<int> AllowedSuccessStatuses = [200, 201, 202, 204];
    private static readonly JsonGenerator Generator = new();

    public static ResolvedEndpointSettings ResolveAndValidate(
        EndpointSettings? input,
        string method,
        Schema schema,
        MockApiOptions options,
        int maxValues
    )
    {
        ArgumentNullException.ThrowIfNull(schema);
        ArgumentNullException.ThrowIfNull(options);

        var limits = options.Limits;
        var defaults = EndpointSettingsDefaults.CreateResolved(method, limits);
        var errors = new SortedDictionary<string, List<string>>(StringComparer.Ordinal);

        var successStatus = input?.SuccessStatus ?? defaults.SuccessStatus;

        if (!AllowedSuccessStatuses.Contains(successStatus))
        {
            Add(errors, "settings.successStatus", "Must be one of 200, 201, 202, 204.");
        }

        var delayMin = input?.Delay?.MinMs ?? defaults.Delay.MinMs;
        var delayMax = input?.Delay?.MaxMs ?? defaults.Delay.MaxMs;
        var maxDelay = Positive(limits.MaxDelayMs, EndpointSettingsDefaults.SpecMaxDelayMs);

        ValidateRange(errors, "settings.delay.minMs", delayMin, 0, maxDelay);
        ValidateRange(errors, "settings.delay.maxMs", delayMax, 0, maxDelay);

        if (delayMin > delayMax)
        {
            Add(errors, "settings.delay.maxMs", "Must be greater than or equal to minMs.");
        }

        var ratePercent = input?.Errors?.RatePercent ?? defaults.Errors.RatePercent;
        var statusCodes = input?.Errors?.StatusCodes ?? defaults.Errors.StatusCodes;
        var maxStatusCodes = Positive(
            limits.MaxErrorStatusCodes,
            EndpointSettingsDefaults.SpecMaxErrorStatusCodes
        );

        if (
            !double.IsFinite(ratePercent)
            || ratePercent is < 0 or > 100
            || Math.Abs(ratePercent * 10 - Math.Round(ratePercent * 10)) > 1e-9
        )
        {
            Add(
                errors,
                "settings.errors.ratePercent",
                "Must be between 0 and 100 with at most one decimal place."
            );
        }

        if (statusCodes.Count > maxStatusCodes)
        {
            Add(
                errors,
                "settings.errors.statusCodes",
                $"Must contain at most {maxStatusCodes} status codes."
            );
        }

        if (ratePercent > 0 && statusCodes.Count == 0)
        {
            Add(
                errors,
                "settings.errors.statusCodes",
                "At least one status code is required when ratePercent is greater than 0."
            );
        }

        var seenStatusCodes = new HashSet<int>();

        for (var index = 0; index < statusCodes.Count; index++)
        {
            var statusCode = statusCodes[index];

            if (statusCode is < 400 or > 599)
            {
                Add(
                    errors,
                    "settings.errors.statusCodes",
                    $"Status code at index {index} must be between 400 and 599."
                );
            }

            if (!seenStatusCodes.Add(statusCode))
            {
                Add(
                    errors,
                    "settings.errors.statusCodes",
                    $"Status code {statusCode} must be unique."
                );
            }
        }

        var listPath = input?.List?.Path ?? defaults.List.Path;
        var listNode = ResolveList(schema.Root, listPath);

        if (listPath is not null && listNode is null)
        {
            var result = JsonPointerResolver.ResolveArray(schema.Root, listPath);

            Add(
                errors,
                "settings.list.path",
                result.Error ?? $"Pointer '{listPath}' must target an array."
            );
        }

        var listMin = input?.List?.Size?.Min ?? defaults.List.Size.Min;
        var listMax = input?.List?.Size?.Max ?? defaults.List.Size.Max;
        var maxListSize = Positive(limits.MaxListSize, EndpointSettingsDefaults.SpecMaxListSize);

        ValidateRange(errors, "settings.list.size.min", listMin, 0, maxListSize);
        ValidateRange(errors, "settings.list.size.max", listMax, 0, maxListSize);

        if (listMin > listMax)
        {
            Add(errors, "settings.list.size.max", "Must be greater than or equal to min.");
        }

        var paginationEnabled = input?.Pagination?.Enabled ?? defaults.Pagination.Enabled;
        var totalItems = input?.Pagination?.TotalItems ?? defaults.Pagination.TotalItems;
        var defaultLimit = input?.Pagination?.DefaultLimit ?? defaults.Pagination.DefaultLimit;
        var maxLimit = input?.Pagination?.MaxLimit ?? defaults.Pagination.MaxLimit;
        var maxTotalItems = Positive(
            limits.MaxPaginationTotalItems,
            EndpointSettingsDefaults.SpecMaxPaginationTotalItems
        );
        var maxPaginationLimit = Positive(
            limits.MaxPaginationLimit,
            EndpointSettingsDefaults.SpecMaxPaginationLimit
        );

        ValidateRange(errors, "settings.pagination.totalItems", totalItems, 0, maxTotalItems);
        ValidateRange(errors, "settings.pagination.maxLimit", maxLimit, 1, maxPaginationLimit);
        ValidateRange(
            errors,
            "settings.pagination.defaultLimit",
            defaultLimit,
            1,
            Math.Max(1, maxLimit)
        );

        if (defaultLimit > maxLimit)
        {
            Add(
                errors,
                "settings.pagination.defaultLimit",
                "defaultLimit must be less than or equal to maxLimit."
            );
        }

        var bindings = ResolveBindings(input?.Pagination?.Bindings, schema.Root, errors);

        if (paginationEnabled && listNode is null)
        {
            Add(
                errors,
                "settings.pagination.enabled",
                "Pagination requires a list: list.path must target an array, or the root must be an array."
            );
        }

        if (errors.Count > 0)
        {
            throw ApiException.Validation(
                errors.ToDictionary(
                    pair => pair.Key,
                    pair => pair.Value.ToArray(),
                    StringComparer.Ordinal
                )
            );
        }

        var effectiveMaxValues =
            maxValues > 0
                ? maxValues
                : Positive(
                    limits.MaxGeneratedValuesPerResponse,
                    EndpointSettingsDefaults.SpecMaxGeneratedValuesPerResponse
                );

        var listMaxForGeneration = paginationEnabled ? maxLimit : listMax;
        var worstCase = Generator.EstimateValueCount(
            schema,
            listNode,
            new GenerationOptions { ListMax = Math.Max(0, listMaxForGeneration) }
        );

        if (worstCase > effectiveMaxValues)
        {
            throw new ApiException(
                422,
                ErrorCodes.ResponseTooLarge,
                $"Generating this endpoint would produce up to {worstCase} values, above the limit of {effectiveMaxValues}."
            );
        }

        return new ResolvedEndpointSettings
        {
            SuccessStatus = successStatus,
            Delay = new ResolvedDelaySettings { MinMs = delayMin, MaxMs = delayMax },
            Errors = new ResolvedErrorSettings
            {
                RatePercent = ratePercent,
                StatusCodes = statusCodes.ToArray(),
            },
            List = new ResolvedListSettings
            {
                Path = listPath,
                Size = new ResolvedListSizeSettings { Min = listMin, Max = listMax },
            },
            Pagination = new ResolvedPaginationSettings
            {
                Enabled = paginationEnabled,
                TotalItems = totalItems,
                DefaultLimit = defaultLimit,
                MaxLimit = maxLimit,
                Bindings = bindings,
            },
            Seed = input?.Seed ?? defaults.Seed,
            Plan = new EndpointSettingsPlan
            {
                ListNode = listNode,
                PaginationEnabled = paginationEnabled,
                ListMin = listMin,
                ListMax = Math.Max(0, listMaxForGeneration),
                WorstCaseValueCount = worstCase,
            },
        };
    }

    /// <summary>Convenience facade for preview/runtime callers.</summary>
    public static PaginationState ParsePageLimit(
        IReadOnlyDictionary<string, string?> query,
        ResolvedEndpointSettings settings
    ) => PaginationCalculator.ParsePageLimit(query, settings);

    /// <summary>Convenience facade for preview/runtime callers.</summary>
    public static PaginationMetadata BuildMetadata(
        string absoluteUrl,
        IReadOnlyDictionary<string, string?> query,
        PaginationState state
    ) => PaginationCalculator.BuildMetadata(absoluteUrl, query, state);

    /// <summary>Convenience facade for preview/runtime callers.</summary>
    public static int ApplyBindings(
        System.Text.Json.Nodes.JsonNode? root,
        ResolvedPaginationBindings bindings,
        PaginationState state
    ) => PaginationCalculator.ApplyBindings(root, bindings, state);

    private static ArrayNode? ResolveList(SchemaNode? root, string? listPath)
    {
        if (listPath is null)
        {
            return root as ArrayNode;
        }

        var result = JsonPointerResolver.ResolveArray(root, listPath);
        return result.Success ? result.Target!.Node as ArrayNode : null;
    }

    private static ResolvedPaginationBindings ResolveBindings(
        PaginationBindings? input,
        SchemaNode? root,
        IDictionary<string, List<string>> errors
    )
    {
        var bindings = new ResolvedPaginationBindings
        {
            Page = ValidateBinding(
                input?.Page,
                "settings.pagination.bindings.page",
                SchemaNodeType.Integer,
                root,
                errors
            ),
            Limit = ValidateBinding(
                input?.Limit,
                "settings.pagination.bindings.limit",
                SchemaNodeType.Integer,
                root,
                errors
            ),
            Total = ValidateBinding(
                input?.Total,
                "settings.pagination.bindings.total",
                SchemaNodeType.Integer,
                root,
                errors
            ),
            TotalPages = ValidateBinding(
                input?.TotalPages,
                "settings.pagination.bindings.totalPages",
                SchemaNodeType.Integer,
                root,
                errors
            ),
            HasNext = ValidateBinding(
                input?.HasNext,
                "settings.pagination.bindings.hasNext",
                SchemaNodeType.Boolean,
                root,
                errors
            ),
            HasPrev = ValidateBinding(
                input?.HasPrev,
                "settings.pagination.bindings.hasPrev",
                SchemaNodeType.Boolean,
                root,
                errors
            ),
        };

        return bindings;
    }

    private static string? ValidateBinding(
        string? pointer,
        string key,
        SchemaNodeType expected,
        SchemaNode? root,
        IDictionary<string, List<string>> errors
    )
    {
        if (pointer is null)
        {
            return null;
        }

        var result = JsonPointerResolver.ResolveLeaf(root, pointer);

        if (!result.Success)
        {
            Add(errors, key, result.Error ?? $"Pointer '{pointer}' must target a leaf.");
            return pointer;
        }

        if (result.Target!.NodeType != expected)
        {
            Add(errors, key, $"Pointer '{pointer}' must target a {expected.ToJsonValue()} leaf.");
        }

        return pointer;
    }

    private static void ValidateRange(
        IDictionary<string, List<string>> errors,
        string key,
        int value,
        int minimum,
        int maximum
    )
    {
        if (value < minimum || value > maximum)
        {
            Add(errors, key, $"Must be between {minimum} and {maximum}.");
        }
    }

    private static void Add(IDictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var messages))
        {
            messages = [];
            errors[key] = messages;
        }

        if (!messages.Contains(message, StringComparer.Ordinal))
        {
            messages.Add(message);
        }
    }

    private static int Positive(int? value, int fallback) => value is > 0 ? value.Value : fallback;
}
