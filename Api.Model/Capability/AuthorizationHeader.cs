namespace Geniusek.Api.Model.Capability;

public record AuthorizationHeader(string Header, string Scheme, string Value)
{
    public AuthorizationHeader(string scheme, string value)
        : this("Authorization", scheme, value)
    {
    }

    public bool IsDefault => string.Equals(Header, "Authorization", StringComparison.InvariantCultureIgnoreCase);
}
