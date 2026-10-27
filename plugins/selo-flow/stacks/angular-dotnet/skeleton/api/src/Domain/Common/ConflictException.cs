namespace {{namespace}}.Domain.Common;

public sealed class ConflictException(string code, string message) : DomainException(code, message);
