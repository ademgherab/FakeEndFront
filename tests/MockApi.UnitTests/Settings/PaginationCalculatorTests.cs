using System.Text.Json.Nodes;
using MockApi.Core.Errors;
using MockApi.Core.Settings;

namespace MockApi.UnitTests.Settings;

public sealed class PaginationCalculatorTests
{
    [Fact]
    public void Defaults_use_page_one_and_the_default_limit()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?>(),
            Paginated(totalItems: 25, defaultLimit: 10)
        );

        Assert.Equal(1, state.Page);
        Assert.Equal(10, state.Limit);
        Assert.Equal(0, state.Start);
        Assert.Equal(10, state.Count);
        Assert.Equal(25, state.TotalItems);
        Assert.Equal(3, state.TotalPages);
    }

    [Fact]
    public void Second_page_math_is_exact()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "2", ["limit"] = "10" },
            Paginated(totalItems: 25)
        );

        Assert.Equal(2, state.Page);
        Assert.Equal(10, state.Start);
        Assert.Equal(10, state.Count);
        Assert.Equal(3, state.TotalPages);
        Assert.True(state.HasPrev);
        Assert.True(state.HasNext);
    }

    [Fact]
    public void Zero_total_items_has_zero_pages_and_an_empty_page()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "1", ["limit"] = "10" },
            Paginated(totalItems: 0)
        );

        Assert.Equal(0, state.TotalPages);
        Assert.Equal(0, state.Count);
        Assert.Equal(0, state.Start);
        Assert.False(state.HasNext);
        Assert.False(state.HasPrev);
    }

    [Fact]
    public void A_page_beyond_the_end_is_empty()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "99", ["limit"] = "10" },
            Paginated(totalItems: 25)
        );

        Assert.Equal(0, state.Count);
        Assert.Equal(3, state.TotalPages);
        Assert.False(state.HasNext);
        Assert.True(state.HasPrev);
    }

    [Fact]
    public void Limit_above_max_limit_is_clamped()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "1", ["limit"] = "1000" },
            Paginated(totalItems: 250, maxLimit: 100)
        );

        Assert.Equal(100, state.Limit);
        Assert.Equal(100, state.Count);
        Assert.Equal(3, state.TotalPages);
    }

    [Fact]
    public void Other_query_parameters_are_ignored()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?>
            {
                ["page"] = "2",
                ["limit"] = "5",
                ["sort"] = "name",
            },
            Paginated(totalItems: 12)
        );

        Assert.Equal(2, state.Page);
        Assert.Equal(5, state.Limit);
        Assert.Equal(5, state.Count);
    }

    public static TheoryData<string, string> InvalidParameters =>
        new()
        {
            { "page", "abc" },
            { "page", "" },
            { "page", "0" },
            { "page", "-1" },
            { "page", "1.5" },
            { "limit", "abc" },
            { "limit", "" },
            { "limit", "0" },
            { "limit", "-2" },
            { "limit", "2.5" },
        };

    [Theory]
    [MemberData(nameof(InvalidParameters))]
    public void Non_integer_or_non_positive_parameters_are_invalid_pagination(
        string name,
        string value
    )
    {
        var exception = Assert.Throws<ApiException>(() =>
            PaginationCalculator.ParsePageLimit(
                new Dictionary<string, string?> { [name] = value },
                Paginated(totalItems: 25)
            )
        );

        Assert.Equal(400, exception.Status);
        Assert.Equal(ErrorCodes.InvalidPagination, exception.Code);
    }

    [Fact]
    public void Link_header_contains_absolute_first_prev_next_and_last_urls()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "2", ["limit"] = "10" },
            Paginated(totalItems: 25)
        );
        var query = new Dictionary<string, string?>
        {
            ["tag"] = "alpha",
            ["page"] = "2",
            ["limit"] = "10",
        };

        var metadata = PaginationCalculator.BuildMetadata(
            "https://api.example.com/m/abc/users",
            query,
            state
        );

        Assert.Equal(
            "<https://api.example.com/m/abc/users?tag=alpha&page=1&limit=10>; rel=\"first\", "
                + "<https://api.example.com/m/abc/users?tag=alpha&page=1&limit=10>; rel=\"prev\", "
                + "<https://api.example.com/m/abc/users?tag=alpha&page=3&limit=10>; rel=\"next\", "
                + "<https://api.example.com/m/abc/users?tag=alpha&page=3&limit=10>; rel=\"last\"",
            metadata.Link
        );
        Assert.Equal(25, metadata.TotalCount);
        Assert.Equal(2, metadata.Page);
        Assert.Equal(10, metadata.Limit);
        Assert.Equal(3, metadata.TotalPages);
    }

    [Fact]
    public void Headers_are_exposed_with_the_expected_names_and_values()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "2", ["limit"] = "10" },
            Paginated(totalItems: 25)
        );
        var headers = PaginationCalculator
            .BuildMetadata(
                "https://api.example.com/m/abc/users",
                new Dictionary<string, string?>(),
                state
            )
            .ToHeaders();

        Assert.Equal("25", headers["X-Total-Count"]);
        Assert.Equal("2", headers["X-Page"]);
        Assert.Equal("10", headers["X-Limit"]);
        Assert.Equal("3", headers["X-Total-Pages"]);
        Assert.Contains("rel=\"first\"", headers["Link"]);
        Assert.Contains("rel=\"last\"", headers["Link"]);
    }

    [Fact]
    public void First_and_last_are_always_present_even_with_zero_items()
    {
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?>(),
            Paginated(totalItems: 0)
        );

        var metadata = PaginationCalculator.BuildMetadata(
            "https://api.example.com/m/abc/users",
            new Dictionary<string, string?>(),
            state
        );

        Assert.Contains("rel=\"first\"", metadata.Link);
        Assert.Contains("rel=\"last\"", metadata.Link);
        Assert.DoesNotContain("rel=\"prev\"", metadata.Link);
        Assert.DoesNotContain("rel=\"next\"", metadata.Link);
    }

    [Fact]
    public void Body_bindings_replace_generated_values_with_correct_types()
    {
        var root = JsonNode.Parse(
            """
            {"meta":{"page":0,"limit":0,"total":0,"totalPages":0,"hasNext":false,"hasPrev":false}}
            """
        )!;
        var bindings = new ResolvedPaginationBindings
        {
            Page = "/meta/page",
            Limit = "/meta/limit",
            Total = "/meta/total",
            TotalPages = "/meta/totalPages",
            HasNext = "/meta/hasNext",
            HasPrev = "/meta/hasPrev",
        };
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?> { ["page"] = "2", ["limit"] = "10" },
            Paginated(totalItems: 25)
        );

        var replaced = PaginationCalculator.ApplyBindings(root, bindings, state);

        Assert.Equal(6, replaced);
        Assert.Equal(2, root["meta"]!["page"]!.GetValue<int>());
        Assert.Equal(10, root["meta"]!["limit"]!.GetValue<int>());
        Assert.Equal(25, root["meta"]!["total"]!.GetValue<int>());
        Assert.Equal(3, root["meta"]!["totalPages"]!.GetValue<int>());
        Assert.True(root["meta"]!["hasNext"]!.GetValue<bool>());
        Assert.True(root["meta"]!["hasPrev"]!.GetValue<bool>());
    }

    [Fact]
    public void Body_bindings_skip_fields_missing_from_the_generated_body()
    {
        var root = JsonNode.Parse("""{"meta":{"page":0}}""")!;
        var bindings = new ResolvedPaginationBindings
        {
            Page = "/meta/page",
            Total = "/meta/missing",
        };
        var state = PaginationCalculator.ParsePageLimit(
            new Dictionary<string, string?>(),
            Paginated(totalItems: 25)
        );

        Assert.Equal(1, PaginationCalculator.ApplyBindings(root, bindings, state));
        Assert.Equal(1, root["meta"]!["page"]!.GetValue<int>());
    }

    private static ResolvedEndpointSettings Paginated(
        int totalItems,
        int maxLimit = 100,
        int defaultLimit = 10
    ) =>
        SettingsTestSupport.Resolve(
            """
            {"pagination":{"enabled":true,"totalItems":TOTAL,"maxLimit":MAX,"defaultLimit":DEFAULT}}
            """.Replace("TOTAL", totalItems.ToString()).Replace("MAX", maxLimit.ToString()).Replace(
                "DEFAULT",
                defaultLimit.ToString()
            ),
            "GET",
            SettingsTestSupport.RootArrayListSchema()
        );
}
