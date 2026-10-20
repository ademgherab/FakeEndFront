namespace MockApi.Core.Errors;

/// <summary>
/// An exception that carries a complete management error contract. Throw this from controllers
/// and services; <see cref="ErrorHandlingMiddleware"/> turns it into RFC 9457 ProblemDetails.
/// </summary>
public sealed class ApiException : Exception
{
    public ApiException(
        int status,
        string code,
        string? detail = null,
        string? title = null,
        IReadOnlyDictionary<string, string[]>? errors = null,
        int? retryAfterSeconds = null,
        Exception? innerException = null
    )
        : base(detail ?? title ?? code, innerException)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(status, 400);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(status, 599);

        var definition = ErrorCodes.Get(code);

        Status = status;
        Code = code;
        Title = title ?? definition.Title;
        Detail = detail ?? definition.Title;
        Errors = errors;
        RetryAfterSeconds = retryAfterSeconds;
    }

    public int Status { get; }

    public string Code { get; }

    public string Title { get; }

    public string Detail { get; }

    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    public int? RetryAfterSeconds { get; }

    public static ApiException Validation(
        IReadOnlyDictionary<string, string[]> errors,
        string detail = "See 'errors' for details."
    ) => new(400, ErrorCodes.ValidationFailed, detail, errors: errors);
}
