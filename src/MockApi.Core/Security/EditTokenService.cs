using System.Security.Cryptography;
using System.Text;

namespace MockApi.Core.Security;

/// <summary>
/// A freshly generated edit token. <see cref="Value"/> is the raw token that may be returned to the
/// creator exactly once; <see cref="Hash"/> is the SHA-256 digest that belongs in the database.
/// </summary>
public readonly record struct GeneratedEditToken(string Value, byte[] Hash);

/// <summary>
/// Generates, hashes and verifies project edit tokens (spec §3, §4.2, §11.3).
/// Tokens are 32 random bytes encoded as <c>et_</c> plus unpadded base64url, and only their
/// SHA-256 digest is stored. No method logs or otherwise exposes a token.
/// </summary>
public sealed class EditTokenService
{
    public const string Prefix = "et_";

    public const int EntropyBytes = 32;

    public const int HashBytes = 32;

    /// <summary>Length of the unpadded base64url part (32 bytes encode to 43 characters).</summary>
    public const int EncodedLength = 43;

    /// <summary>Total raw token length, including the three-character <c>et_</c> prefix.</summary>
    public const int TokenLength = 3 + EncodedLength;

    public GeneratedEditToken Generate()
    {
        var entropy = RandomNumberGenerator.GetBytes(EntropyBytes);
        var value = Prefix + Base64UrlEncode(entropy);

        return new GeneratedEditToken(value, Hash(value));
    }

    public byte[] Hash(string token)
    {
        ArgumentException.ThrowIfNullOrEmpty(token);

        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }

    /// <summary>
    /// Verifies a raw token against a stored digest. Malformed tokens, missing hashes and hashes of
    /// an unexpected length return <see langword="false"/> without throwing. Well-formed inputs are
    /// compared with <see cref="CryptographicOperations.FixedTimeEquals(ReadOnlySpan{byte}, ReadOnlySpan{byte})"/>.
    /// </summary>
    public bool Verify(string? token, byte[]? expectedHash)
    {
        if (!IsWellFormed(token) || expectedHash is null || expectedHash.Length != HashBytes)
        {
            return false;
        }

        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(token!));

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static bool IsWellFormed(string? token)
    {
        if (
            token is null
            || token.Length != TokenLength
            || !token.StartsWith(Prefix, StringComparison.Ordinal)
        )
        {
            return false;
        }

        foreach (var character in token.AsSpan(Prefix.Length))
        {
            var isBase64Url =
                character
                is >= 'A'
                    and <= 'Z'
                    or >= 'a'
                    and <= 'z'
                    or >= '0'
                    and <= '9'
                    or '-'
                    or '_';

            if (!isBase64Url)
            {
                return false;
            }
        }

        return true;
    }

    private static string Base64UrlEncode(ReadOnlySpan<byte> value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
