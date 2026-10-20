using System.Security.Cryptography;
using System.Text;
using MockApi.Core.Security;

namespace MockApi.UnitTests.Security;

public sealed class EditTokenServiceTests
{
    private readonly EditTokenService _service = new();

    [Fact]
    public void Generate_returns_prefixed_unpadded_base64url_token()
    {
        var generated = _service.Generate();

        Assert.StartsWith(EditTokenService.Prefix, generated.Value, StringComparison.Ordinal);
        Assert.Equal(46, generated.Value.Length);
        Assert.Equal(EditTokenService.TokenLength, generated.Value.Length);

        var encoded = generated.Value[EditTokenService.Prefix.Length..];
        Assert.Equal(43, encoded.Length);
        Assert.Equal(EditTokenService.EncodedLength, encoded.Length);
        Assert.DoesNotContain('=', encoded);
        Assert.DoesNotContain('+', encoded);
        Assert.DoesNotContain('/', encoded);
        Assert.All(
            encoded,
            character =>
                Assert.True(
                    char.IsAsciiLetterOrDigit(character) || character is '-' or '_',
                    $"Unexpected base64url character '{character}'."
                )
        );
    }

    [Fact]
    public void Generate_returns_sha256_hash_of_the_raw_token()
    {
        var generated = _service.Generate();

        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(generated.Value));

        Assert.Equal(EditTokenService.HashBytes, generated.Hash.Length);
        Assert.Equal(expected, generated.Hash);
    }

    [Fact]
    public void Hash_is_deterministic_across_calls()
    {
        var generated = _service.Generate();

        var first = _service.Hash(generated.Value);
        var second = _service.Hash(generated.Value);

        Assert.Equal(first, second);
    }

    [Fact]
    public void Verify_accepts_the_generated_token()
    {
        var generated = _service.Generate();

        Assert.True(_service.Verify(generated.Value, generated.Hash));
    }

    [Fact]
    public void Verify_rejects_a_different_token()
    {
        var generated = _service.Generate();
        var other = _service.Generate();

        Assert.False(_service.Verify(other.Value, generated.Hash));
        Assert.False(_service.Verify(generated.Value, other.Hash));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("et_")]
    [InlineData("not-a-token")]
    [InlineData("et_short")]
    [InlineData("et_0123456789012345678901234567890123456789012")]
    [InlineData("et_012345678901234567890123456789012345678901+")]
    public void Verify_rejects_malformed_tokens_without_throwing(string? token)
    {
        var generated = _service.Generate();

        Assert.False(_service.Verify(token, generated.Hash));
    }

    [Fact]
    public void Verify_rejects_missing_or_unequal_length_hashes_without_throwing()
    {
        var generated = _service.Generate();

        Assert.False(_service.Verify(generated.Value, expectedHash: null));
        Assert.False(_service.Verify(generated.Value, []));
        Assert.False(_service.Verify(generated.Value, generated.Hash.AsSpan(0, 31).ToArray()));
        Assert.False(_service.Verify(generated.Value, [.. generated.Hash, 0x00]));
    }

    [Fact]
    public void Generate_produces_distinct_tokens()
    {
        var tokens = Enumerable
            .Range(0, 64)
            .Select(_ => _service.Generate().Value)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(64, tokens.Count);
    }
}
