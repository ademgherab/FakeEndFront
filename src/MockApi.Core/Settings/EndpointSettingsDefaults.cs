using MockApi.Core.Configuration;

namespace MockApi.Core.Settings;

/// <summary>
/// The single source of truth for endpoint-settings defaults (technical spec §8.1/§8.2).
/// Nothing outside this type may repeat these literals.
/// </summary>
public static class EndpointSettingsDefaults
{
    public const int GetSuccessStatus = 200;
    public const int PostSuccessStatus = 201;
    public const int PutSuccessStatus = 200;
    public const int DeleteSuccessStatus = 204;

    public const int DefaultDelayMinMs = 0;
    public const int DefaultDelayMaxMs = 0;

    public const double DefaultErrorRatePercent = 0;
    public const int DefaultErrorStatusCode = 500;

    public const int DefaultListSize = 10;

    public const bool DefaultPaginationEnabled = false;
    public const int DefaultPaginationTotalItems = 100;
    public const int DefaultPaginationDefaultLimit = 10;
    public const int DefaultPaginationMaxLimit = 100;

    public const int SpecMaxDelayMs = 10_000;
    public const int SpecMaxListSize = 1_000;
    public const int SpecMaxPaginationTotalItems = 10_000;
    public const int SpecMaxPaginationLimit = 100;
    public const int SpecMaxErrorStatusCodes = 10;
    public const int SpecMaxGeneratedValuesPerResponse = 100_000;

    public static int SuccessStatusForMethod(string? method) =>
        method?.Trim().ToUpperInvariant() switch
        {
            "POST" => PostSuccessStatus,
            "DELETE" => DeleteSuccessStatus,
            "PUT" => PutSuccessStatus,
            _ => GetSuccessStatus,
        };

    public static EndpointSettings Create(string method, LimitsOptions? limits = null) =>
        ToInput(CreateResolved(method, limits));

    public static ResolvedEndpointSettings CreateResolved(
        string method,
        LimitsOptions? limits = null
    )
    {
        var maxListSize = Positive(limits?.MaxListSize, SpecMaxListSize);
        var listSize = Math.Min(DefaultListSize, maxListSize);
        var maxPaginationLimit = Math.Min(
            DefaultPaginationMaxLimit,
            Positive(limits?.MaxPaginationLimit, SpecMaxPaginationLimit)
        );
        var totalItems = Math.Min(
            DefaultPaginationTotalItems,
            Positive(limits?.MaxPaginationTotalItems, SpecMaxPaginationTotalItems)
        );

        return new ResolvedEndpointSettings
        {
            SuccessStatus = SuccessStatusForMethod(method),
            Delay = new ResolvedDelaySettings
            {
                MinMs = DefaultDelayMinMs,
                MaxMs = DefaultDelayMaxMs,
            },
            Errors = new ResolvedErrorSettings
            {
                RatePercent = DefaultErrorRatePercent,
                StatusCodes = [DefaultErrorStatusCode],
            },
            List = new ResolvedListSettings
            {
                Path = null,
                Size = new ResolvedListSizeSettings { Min = listSize, Max = listSize },
            },
            Pagination = new ResolvedPaginationSettings
            {
                Enabled = DefaultPaginationEnabled,
                TotalItems = totalItems,
                DefaultLimit = Math.Min(DefaultPaginationDefaultLimit, maxPaginationLimit),
                MaxLimit = maxPaginationLimit,
                Bindings = new ResolvedPaginationBindings(),
            },
            Seed = null,
            Plan = new EndpointSettingsPlan
            {
                ListNode = null,
                PaginationEnabled = DefaultPaginationEnabled,
                ListMin = listSize,
                ListMax = listSize,
            },
        };
    }

    /// <summary>Copies a resolved settings object back into the input shape for convenient output.</summary>
    public static EndpointSettings ToInput(ResolvedEndpointSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        return new EndpointSettings
        {
            SuccessStatus = settings.SuccessStatus,
            Delay = new DelaySettings
            {
                MinMs = settings.Delay.MinMs,
                MaxMs = settings.Delay.MaxMs,
            },
            Errors = new ErrorSettings
            {
                RatePercent = settings.Errors.RatePercent,
                StatusCodes = settings.Errors.StatusCodes,
            },
            List = new ListSettings
            {
                Path = settings.List.Path,
                Size = new ListSizeSettings
                {
                    Min = settings.List.Size.Min,
                    Max = settings.List.Size.Max,
                },
            },
            Pagination = new PaginationSettings
            {
                Enabled = settings.Pagination.Enabled,
                TotalItems = settings.Pagination.TotalItems,
                DefaultLimit = settings.Pagination.DefaultLimit,
                MaxLimit = settings.Pagination.MaxLimit,
                Bindings = new PaginationBindings
                {
                    Page = settings.Pagination.Bindings.Page,
                    Limit = settings.Pagination.Bindings.Limit,
                    Total = settings.Pagination.Bindings.Total,
                    TotalPages = settings.Pagination.Bindings.TotalPages,
                    HasNext = settings.Pagination.Bindings.HasNext,
                    HasPrev = settings.Pagination.Bindings.HasPrev,
                },
            },
            Seed = settings.Seed,
        };
    }

    private static int Positive(int? value, int fallback) => value is > 0 ? value.Value : fallback;
}
