using MockApi.Core.Errors;
using MockApi.Core.Settings;

namespace MockApi.UnitTests.Settings;

public sealed class EndpointSettingsValidationTests
{
    public static TheoryData<string, string> InvalidSettings =>
        new()
        {
            { """{"successStatus":203}""", "settings.successStatus" },
            { """{"delay":{"minMs":-1,"maxMs":0}}""", "settings.delay.minMs" },
            { """{"delay":{"minMs":0,"maxMs":10001}}""", "settings.delay.maxMs" },
            { """{"delay":{"minMs":500,"maxMs":100}}""", "settings.delay.maxMs" },
            { """{"errors":{"ratePercent":-0.1}}""", "settings.errors.ratePercent" },
            { """{"errors":{"ratePercent":100.1}}""", "settings.errors.ratePercent" },
            { """{"errors":{"ratePercent":10.55}}""", "settings.errors.ratePercent" },
            { """{"errors":{"ratePercent":10,"statusCodes":[]}}""", "settings.errors.statusCodes" },
            {
                """{"errors":{"statusCodes":[400,401,402,403,404,405,406,407,408,409,410]}}""",
                "settings.errors.statusCodes"
            },
            { """{"errors":{"statusCodes":[500,500]}}""", "settings.errors.statusCodes" },
            { """{"errors":{"statusCodes":[399]}}""", "settings.errors.statusCodes" },
            { """{"errors":{"statusCodes":[600]}}""", "settings.errors.statusCodes" },
            { """{"list":{"size":{"min":-1,"max":10}}}""", "settings.list.size.min" },
            { """{"list":{"size":{"min":0,"max":1001}}}""", "settings.list.size.max" },
            { """{"list":{"size":{"min":20,"max":10}}}""", "settings.list.size.max" },
            { """{"pagination":{"totalItems":-1}}""", "settings.pagination.totalItems" },
            { """{"pagination":{"totalItems":10001}}""", "settings.pagination.totalItems" },
            { """{"pagination":{"maxLimit":0}}""", "settings.pagination.maxLimit" },
            { """{"pagination":{"maxLimit":101}}""", "settings.pagination.maxLimit" },
            { """{"pagination":{"defaultLimit":0}}""", "settings.pagination.defaultLimit" },
            {
                """{"pagination":{"defaultLimit":11,"maxLimit":10}}""",
                "settings.pagination.defaultLimit"
            },
        };

    [Theory]
    [MemberData(nameof(InvalidSettings))]
    public void Invalid_settings_return_validation_failed_with_the_offending_key(
        string json,
        string key
    )
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(json, "GET", SettingsTestSupport.RootArrayListSchema())
        );

        Assert.Equal(400, exception.Status);
        Assert.Equal(ErrorCodes.ValidationFailed, exception.Code);
        Assert.NotNull(exception.Errors);
        Assert.Contains(key, exception.Errors!.Keys);
    }

    public static TheoryData<string> ValidBoundarySettings =>
        new()
        {
            """{"successStatus":204}""",
            """{"delay":{"minMs":0,"maxMs":0}}""",
            """{"delay":{"minMs":10000,"maxMs":10000}}""",
            """{"errors":{"ratePercent":0,"statusCodes":[]}}""",
            """{"errors":{"ratePercent":0.1,"statusCodes":[400]}}""",
            """{"errors":{"ratePercent":100,"statusCodes":[400,599]}}""",
            """{"list":{"size":{"min":0,"max":0}}}""",
            """{"list":{"size":{"min":0,"max":1000}}}""",
            """{"pagination":{"totalItems":0,"maxLimit":1,"defaultLimit":1}}""",
            """{"pagination":{"totalItems":10000,"maxLimit":100,"defaultLimit":100}}""",
            """{"pagination":{"enabled":true,"totalItems":0,"maxLimit":100,"defaultLimit":100}}""",
        };

    [Theory]
    [MemberData(nameof(ValidBoundarySettings))]
    public void Boundary_settings_are_accepted(string json)
    {
        var resolved = SettingsTestSupport.Resolve(
            json,
            "GET",
            SettingsTestSupport.RootArrayListSchema()
        );

        Assert.NotNull(resolved);
    }

    [Fact]
    public void Pagination_requires_a_usable_list()
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """{"pagination":{"enabled":true}}""",
                "GET",
                SettingsTestSupport.ObjectWithoutDataSchema()
            )
        );

        Assert.Equal(400, exception.Status);
        Assert.Equal(ErrorCodes.ValidationFailed, exception.Code);
        Assert.Contains("settings.pagination.enabled", exception.Errors!.Keys);
    }

    [Fact]
    public void A_list_path_that_does_not_resolve_is_rejected()
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """{"list":{"path":"/missing"}}""",
                "GET",
                SettingsTestSupport.ObjectWithDataAndMetaSchema()
            )
        );

        Assert.Contains("settings.list.path", exception.Errors!.Keys);
    }

    [Fact]
    public void A_list_path_must_target_an_array()
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """{"list":{"path":"/meta"}}""",
                "GET",
                SettingsTestSupport.ObjectWithDataAndMetaSchema()
            )
        );

        Assert.Contains("settings.list.path", exception.Errors!.Keys);
    }

    [Fact]
    public void A_resolvable_list_path_is_accepted()
    {
        var resolved = SettingsTestSupport.Resolve(
            """{"list":{"path":"/data"}}""",
            "GET",
            SettingsTestSupport.ObjectWithDataAndMetaSchema()
        );

        Assert.Equal("/data", resolved.List.Path);
        Assert.IsType<MockApi.Core.Schemas.ArrayNode>(resolved.Plan.ListNode);
        Assert.True(resolved.Plan.HasList);
    }

    public static TheoryData<string, string> InvalidBindings =>
        new()
        {
            {
                """{"pagination":{"bindings":{"page":"/meta/hasNext"}}}""",
                "settings.pagination.bindings.page"
            },
            {
                """{"pagination":{"bindings":{"hasNext":"/meta/page"}}}""",
                "settings.pagination.bindings.hasNext"
            },
            {
                """{"pagination":{"bindings":{"total":"/missing"}}}""",
                "settings.pagination.bindings.total"
            },
        };

    [Theory]
    [MemberData(nameof(InvalidBindings))]
    public void Binding_pointers_must_resolve_to_compatible_leaves(string json, string key)
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                json,
                "GET",
                SettingsTestSupport.ObjectWithDataAndMetaSchema()
            )
        );

        Assert.Equal(400, exception.Status);
        Assert.Contains(key, exception.Errors!.Keys);
    }

    [Fact]
    public void Compatible_binding_pointers_are_kept()
    {
        var resolved = SettingsTestSupport.Resolve(
            """
            {"pagination":{"bindings":{
              "page":"/meta/page","limit":"/meta/limit","total":"/meta/total",
              "totalPages":"/meta/totalPages","hasNext":"/meta/hasNext","hasPrev":"/meta/hasPrev"
            }}}
            """,
            "GET",
            SettingsTestSupport.ObjectWithDataAndMetaSchema()
        );

        Assert.Equal("/meta/page", resolved.Pagination.Bindings.Page);
        Assert.Equal("/meta/hasNext", resolved.Pagination.Bindings.HasNext);
    }

    [Fact]
    public void Multiple_validation_issues_are_collected()
    {
        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """{"successStatus":203,"delay":{"minMs":500,"maxMs":100}}""",
                "GET",
                SettingsTestSupport.RootArrayListSchema()
            )
        );

        Assert.True(exception.Errors!.Count >= 2);
    }

    [Fact]
    public void Worst_case_generated_values_over_the_limit_return_response_too_large()
    {
        var schema = NestedListSchema(200);

        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """{"list":{"path":"/data","size":{"min":1000,"max":1000}}}""",
                "GET",
                schema
            )
        );

        Assert.Equal(422, exception.Status);
        Assert.Equal(ErrorCodes.ResponseTooLarge, exception.Code);
    }

    [Fact]
    public void Pagination_uses_max_limit_for_the_worst_case_check()
    {
        var schema = NestedListSchema(2_000);

        Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                """
                {"list":{"size":{"min":1000,"max":1000}},
                 "pagination":{"enabled":true,"totalItems":10000,"maxLimit":100,"defaultLimit":10}}
                """,
                "GET",
                schema
            )
        );
    }

    [Fact]
    public void Exactly_the_value_limit_is_accepted()
    {
        var resolved = SettingsTestSupport.Resolve(
            """{"list":{"path":"/data","size":{"min":1000,"max":1000}}}""",
            "GET",
            NestedListSchema(100)
        );

        Assert.Equal(100_000, resolved.Plan.WorstCaseValueCount);
    }

    [Fact]
    public void Replacing_the_schema_invalidates_existing_cross_checks()
    {
        const string settings = """{"list":{"path":"/data"}}""";

        var valid = SettingsTestSupport.Resolve(
            settings,
            "GET",
            SettingsTestSupport.ObjectWithDataAndMetaSchema()
        );
        Assert.True(valid.Plan.HasList);

        var exception = Assert.Throws<ApiException>(() =>
            SettingsTestSupport.Resolve(
                settings,
                "GET",
                SettingsTestSupport.ObjectWithoutDataSchema()
            )
        );

        Assert.Contains("settings.list.path", exception.Errors!.Keys);
    }

    private static MockApi.Core.Schemas.Schema NestedListSchema(int nestedMax) =>
        SettingsTestSupport.Schema(
            """
            {"version":1,"root":{"type":"object","fields":[
              {"name":"data","node":{"type":"array","item":{"type":"object","fields":[
                {"name":"tags","node":{"type":"array","length":{"min":NESTED,"max":NESTED},"item":{"type":"string","generator":{"name":"uuid"}}}}
              ]}}}
            ]}}
            """.Replace("NESTED", nestedMax.ToString())
        );
}
