namespace RosterComp.Domain.Common;

public sealed class NotFoundException(string entity, object id)
    : DomainException("not_found", $"{entity} {id} does not exist");
