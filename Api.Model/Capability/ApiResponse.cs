namespace Geniusek.Api.Model.Capability;

public class ApiResponse
{
    public int StatusCode { get; }
    public string Content { get; }
    public string Error { get; init; }
    public AuthorizationHeader? AuthorizationHeader { get; init; }

    public ApiResponse(int statusCode, string content)
    {
        StatusCode = statusCode;
        Content = content;
    }

    public bool IsSuccessStatusCode => StatusCode >= 200 && StatusCode <= 299;
}
