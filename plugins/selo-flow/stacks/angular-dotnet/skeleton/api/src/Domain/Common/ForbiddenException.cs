namespace {{namespace}}.Domain.Common;

public sealed class ForbiddenException(string message = "Forbidden") : DomainException("forbidden", message);
