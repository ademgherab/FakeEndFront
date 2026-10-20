using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using MockApi.Core.Errors;

namespace MockApi.Core.Settings;

/// <summary>
/// One page of a paginated response (technical spec §8.4).
/// </summary>
public sealed record PaginationState(
    int Page,
    int Limit,
    long Start,
    int Count,
    int TotalItems,
    int TotalPages
)
{
    public bool HasNext => Page < TotalPages;

    public bool HasPrev => Page > 1;
}

/// <summary>
/// The metadata that always goes into headers for a paginated response.
/// </summary>
public sealed record PaginationMetadata(
    int TotalCount,
    int Page,
    int Limit,
    int TotalPages,
    string Link
)
{
    public IReadOnlyDictionary<string, string> ToHeaders() =>
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["X-Total-Count"] = TotalCount.ToString(CultureInfo.InvariantCulture),
            ["X-Page"] = Page.ToString(CultureInfo.InvariantCulture),
            ["X-Limit"] = Limit.ToString(CultureInfo.InvariantCulture),
            ["X-Total-Pages"] = TotalPages.ToString(CultureInfo.InvariantCulture),
            ["Link"] = Link,
        };
}

/// <summary>
/// Pagination parsing, arithmetic, link/header building and body binding replacement. Shared by
/// preview and runtime so both paths cannot drift (technical spec §8.4).
/// </summary>
public static class PaginationCalculator
{
    public static PaginationState ParsePageLimit(
        IReadOnlyDictionary<string, string?> query,
        ResolvedEndpointSettings settings
    )
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(settings);

        var page = ReadPositive(query, "page", 1);
        var requestedLimit = ReadPositive(
            query,
            "limit",
            Math.Max(1, settings.Pagination.DefaultLimit)
        );
        var maxLimit = Math.Max(1, settings.Pagination.MaxLimit);
        var limit = Math.Min(requestedLimit, maxLimit);
        var totalItems = Math.Max(0, settings.Pagination.TotalItems);

        var start = (long)(page - 1) * limit;
        var count = start >= totalItems ? 0 : (int)Math.Min(limit, totalItems - start);
        var totalPages = totalItems == 0 ? 0 : (int)((totalItems + (long)limit - 1) / limit);

        return new PaginationState(page, limit, start, count, totalItems, totalPages);
    }

    public static PaginationState ParsePageLimit(
        IQueryCollection query,
        ResolvedEndpointSettings settings
    )
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(settings);

        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in query)
        {
            values[pair.Key] = pair.Value.Count == 0 ? string.Empty : pair.Value[0];
        }

        return ParsePageLimit(values, settings);
    }

    public static PaginationMetadata BuildMetadata(
        string absoluteUrl,
        IReadOnlyDictionary<string, string?> query,
        PaginationState state
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(absoluteUrl);
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(state);

        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var baseUri))
        {
            throw new ArgumentException("A valid absolute URL is required.", nameof(absoluteUrl));
        }

        var otherParameters = new List<KeyValuePair<string, string?>>();

        foreach (var pair in ReadQuery(baseUri))
        {
            if (!IsPaginationParameter(pair.Key))
            {
                otherParameters.Add(pair);
            }
        }

        foreach (var pair in query)
        {
            if (!IsPaginationParameter(pair.Key))
            {
                otherParameters.Add(pair);
            }
        }

        return BuildMetadata(baseUri, otherParameters, state);
    }

    public static PaginationMetadata BuildMetadata(
        string absoluteUrl,
        IQueryCollection query,
        PaginationState state
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(absoluteUrl);
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(state);

        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var baseUri))
        {
            throw new ArgumentException("A valid absolute URL is required.", nameof(absoluteUrl));
        }

        var otherParameters = new List<KeyValuePair<string, string?>>();

        foreach (var pair in ReadQuery(baseUri))
        {
            if (!IsPaginationParameter(pair.Key))
            {
                otherParameters.Add(pair);
            }
        }

        foreach (var pair in query)
        {
            if (IsPaginationParameter(pair.Key))
            {
                continue;
            }

            if (pair.Value.Count == 0)
            {
                otherParameters.Add(new KeyValuePair<string, string?>(pair.Key, string.Empty));
                continue;
            }

            foreach (var value in pair.Value)
            {
                otherParameters.Add(new KeyValuePair<string, string?>(pair.Key, value));
            }
        }

        return BuildMetadata(baseUri, otherParameters, state);
    }

    private static PaginationMetadata BuildMetadata(
        Uri baseUri,
        IReadOnlyList<KeyValuePair<string, string?>> otherParameters,
        PaginationState state
    )
    {
        var lastPage = Math.Max(1, state.TotalPages);
        var links = new List<string>
        {
            FormatLink("first", BuildUrl(baseUri, otherParameters, 1, state.Limit)),
        };

        if (state.Page > 1)
        {
            links.Add(
                FormatLink("prev", BuildUrl(baseUri, otherParameters, state.Page - 1, state.Limit))
            );
        }

        if (state.Page < state.TotalPages)
        {
            links.Add(
                FormatLink("next", BuildUrl(baseUri, otherParameters, state.Page + 1, state.Limit))
            );
        }

        links.Add(FormatLink("last", BuildUrl(baseUri, otherParameters, lastPage, state.Limit)));

        return new PaginationMetadata(
            state.TotalItems,
            state.Page,
            state.Limit,
            state.TotalPages,
            string.Join(", ", links)
        );
    }

    /// <summary>
    /// Replaces every configured body binding with its real pagination value. Missing or omitted
    /// generated fields are skipped, matching the runtime's omit/null probabilities. Returns the
    /// number of replaced leaves.
    /// </summary>
    public static int ApplyBindings(
        JsonNode? root,
        ResolvedPaginationBindings bindings,
        PaginationState state
    )
    {
        ArgumentNullException.ThrowIfNull(bindings);
        ArgumentNullException.ThrowIfNull(state);

        if (root is null)
        {
            return 0;
        }

        var replacements = new (string? Pointer, JsonNode? Value)[]
        {
            (bindings.Page, JsonValue.Create(state.Page)),
            (bindings.Limit, JsonValue.Create(state.Limit)),
            (bindings.Total, JsonValue.Create(state.TotalItems)),
            (bindings.TotalPages, JsonValue.Create(state.TotalPages)),
            (bindings.HasNext, JsonValue.Create(state.HasNext)),
            (bindings.HasPrev, JsonValue.Create(state.HasPrev)),
        };

        var replaced = 0;

        foreach (var replacement in replacements)
        {
            if (
                replacement.Pointer is { } pointer
                && replacement.Value is { } value
                && TryReplace(root, pointer, value)
            )
            {
                replaced++;
            }
        }

        return replaced;
    }

    private static int ReadPositive(
        IReadOnlyDictionary<string, string?> query,
        string name,
        int fallback
    )
    {
        if (!query.TryGetValue(name, out var raw) || raw is null)
        {
            return fallback;
        }

        if (
            !int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var value)
            || value < 1
        )
        {
            throw new ApiException(
                400,
                ErrorCodes.InvalidPagination,
                $"Query parameter '{name}' must be an integer greater than or equal to 1."
            );
        }

        return value;
    }

    private static IEnumerable<KeyValuePair<string, string?>> ReadQuery(Uri uri)
    {
        if (string.IsNullOrEmpty(uri.Query))
        {
            yield break;
        }

        foreach (
            var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
        )
        {
            var separator = part.IndexOf('=');
            var key = separator < 0 ? part : part[..separator];
            var value = separator < 0 ? string.Empty : part[(separator + 1)..];

            yield return new KeyValuePair<string, string?>(
                Uri.UnescapeDataString(key),
                Uri.UnescapeDataString(value)
            );
        }
    }

    private static bool IsPaginationParameter(string name) =>
        string.Equals(name, "page", StringComparison.OrdinalIgnoreCase)
        || string.Equals(name, "limit", StringComparison.OrdinalIgnoreCase);

    private static string BuildUrl(
        Uri baseUri,
        IReadOnlyList<KeyValuePair<string, string?>> otherParameters,
        int page,
        int limit
    )
    {
        var builder = new StringBuilder();

        void Append(string key, string? value)
        {
            if (builder.Length > 0)
            {
                builder.Append('&');
            }

            builder
                .Append(Uri.EscapeDataString(key))
                .Append('=')
                .Append(Uri.EscapeDataString(value ?? string.Empty));
        }

        foreach (var pair in otherParameters)
        {
            Append(pair.Key, pair.Value);
        }

        Append("page", page.ToString(CultureInfo.InvariantCulture));
        Append("limit", limit.ToString(CultureInfo.InvariantCulture));

        return new UriBuilder(baseUri) { Query = builder.ToString(), Fragment = string.Empty }
            .Uri
            .AbsoluteUri;
    }

    private static string FormatLink(string relation, string url) => $"<{url}>; rel=\"{relation}\"";

    private static bool TryReplace(JsonNode root, string pointer, JsonNode value)
    {
        if (!pointer.StartsWith('/'))
        {
            return false;
        }

        var tokens = pointer[1..].Split('/');

        for (var index = 0; index < tokens.Length; index++)
        {
            tokens[index] = Unescape(tokens[index]);
        }

        return TryReplace(root, tokens, 0, value);
    }

    private static bool TryReplace(JsonNode? current, string[] tokens, int index, JsonNode value)
    {
        if (current is null || index >= tokens.Length)
        {
            return false;
        }

        var token = tokens[index];

        if (index == tokens.Length - 1)
        {
            if (current is JsonObject jsonObject && jsonObject.ContainsKey(token))
            {
                jsonObject[token] = value;
                return true;
            }

            if (
                current is JsonArray jsonArray
                && int.TryParse(
                    token,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var itemIndex
                )
                && itemIndex >= 0
                && itemIndex < jsonArray.Count
            )
            {
                jsonArray[itemIndex] = value;
                return true;
            }

            return false;
        }

        var next = current switch
        {
            JsonObject jsonObject when jsonObject.ContainsKey(token) => jsonObject[token],
            JsonArray jsonArray
                when int.TryParse(
                    token,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var itemIndex
                )
                    && itemIndex >= 0
                    && itemIndex < jsonArray.Count => jsonArray[itemIndex],
            _ => null,
        };

        return TryReplace(next, tokens, index + 1, value);
    }

    private static string Unescape(string token)
    {
        if (token.IndexOf('~') < 0)
        {
            return token;
        }

        var builder = new StringBuilder(token.Length);

        for (var index = 0; index < token.Length; index++)
        {
            if (token[index] == '~' && index + 1 < token.Length)
            {
                var escaped = token[++index];

                if (escaped == '0')
                {
                    builder.Append('~');
                    continue;
                }

                if (escaped == '1')
                {
                    builder.Append('/');
                    continue;
                }

                builder.Append('~').Append(escaped);
                continue;
            }

            builder.Append(token[index]);
        }

        return builder.ToString();
    }
}
