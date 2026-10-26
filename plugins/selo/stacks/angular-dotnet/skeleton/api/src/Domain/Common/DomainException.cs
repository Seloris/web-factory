namespace {{namespace}}.Domain.Common;

/// <summary>
/// A broken business rule, with a stable code the client can read. The Api answers it with a problem details response.
/// </summary>
public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
