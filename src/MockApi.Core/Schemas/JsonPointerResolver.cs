namespace MockApi.Core.Schemas;

public sealed record JsonPointerTarget(SchemaNode Node, string Pointer)
{
    public SchemaNodeType NodeType => Node.NodeType;
}

public sealed class JsonPointerResult
{
    private JsonPointerResult(JsonPointerTarget? target, string? error)
    {
        Target = target;
        Error = error;
    }

    public JsonPointerTarget? Target { get; }

    public string? Error { get; }

    public bool Success => Target is not null;

    public static JsonPointerResult Resolved(JsonPointerTarget target) => new(target, null);

    public static JsonPointerResult Failed(string error) => new(null, error);
}

/// <summary>
/// Resolves RFC 6901 JSON Pointers against a schema tree. Object tokens address fields by name;
/// the token <c>item</c> addresses an array's item node. No data values are involved.
/// </summary>
public static class JsonPointerResolver
{
    public static JsonPointerResult Resolve(SchemaNode? root, string? pointer)
    {
        if (root is null)
        {
            return JsonPointerResult.Failed("A schema root is required.");
        }

        if (string.IsNullOrEmpty(pointer))
        {
            return JsonPointerResult.Resolved(new JsonPointerTarget(root, string.Empty));
        }

        if (!pointer.StartsWith('/'))
        {
            return JsonPointerResult.Failed("A JSON Pointer must start with '/'.");
        }

        var current = root;

        foreach (var rawToken in pointer[1..].Split('/'))
        {
            if (!TryUnescape(rawToken, out var token, out var unescapeError))
            {
                return JsonPointerResult.Failed(unescapeError);
            }

            if (current is ObjectNode objectNode)
            {
                var field = objectNode.Fields.FirstOrDefault(candidate =>
                    string.Equals(candidate.Name, token, StringComparison.Ordinal)
                );

                if (field?.Node is null)
                {
                    return JsonPointerResult.Failed($"No field named '{token}' exists.");
                }

                current = field.Node;
                continue;
            }

            if (current is ArrayNode arrayNode)
            {
                if (!string.Equals(token, "item", StringComparison.Ordinal))
                {
                    return JsonPointerResult.Failed(
                        $"Array pointers must address 'item', not '{token}'."
                    );
                }

                if (arrayNode.Item is null)
                {
                    return JsonPointerResult.Failed("The array has no item node.");
                }

                current = arrayNode.Item;
                continue;
            }

            return JsonPointerResult.Failed(
                $"Cannot traverse into a '{current.NodeType.ToJsonValue()}' node."
            );
        }

        return JsonPointerResult.Resolved(new JsonPointerTarget(current, pointer));
    }

    public static JsonPointerResult ResolveArray(SchemaNode? root, string? pointer)
    {
        var result = Resolve(root, pointer);

        if (!result.Success)
        {
            return result;
        }

        return result.Target!.Node is ArrayNode
            ? result
            : JsonPointerResult.Failed(
                $"Pointer '{pointer}' must target an array, but targets '{result.Target.NodeType.ToJsonValue()}'."
            );
    }

    public static JsonPointerResult ResolveLeaf(SchemaNode? root, string? pointer)
    {
        var result = Resolve(root, pointer);

        if (!result.Success)
        {
            return result;
        }

        return result.Target!.NodeType.IsLeaf()
            ? result
            : JsonPointerResult.Failed(
                $"Pointer '{pointer}' must target a leaf, but targets '{result.Target.NodeType.ToJsonValue()}'."
            );
    }

    private static bool TryUnescape(string token, out string value, out string error)
    {
        if (token.IndexOf('~') < 0)
        {
            value = token;
            error = string.Empty;
            return true;
        }

        var builder = new System.Text.StringBuilder(token.Length);

        for (var index = 0; index < token.Length; index++)
        {
            var character = token[index];

            if (character != '~')
            {
                builder.Append(character);
                continue;
            }

            if (index + 1 >= token.Length)
            {
                value = string.Empty;
                error = "A JSON Pointer escape sequence is incomplete.";
                return false;
            }

            var escaped = token[++index];

            if (escaped == '0')
            {
                builder.Append('~');
            }
            else if (escaped == '1')
            {
                builder.Append('/');
            }
            else
            {
                value = string.Empty;
                error = $"Unknown JSON Pointer escape sequence '~{escaped}'.";
                return false;
            }
        }

        value = builder.ToString();
        error = string.Empty;
        return true;
    }
}
