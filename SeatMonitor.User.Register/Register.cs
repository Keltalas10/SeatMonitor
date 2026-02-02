using Geniusek.Api.Model.Capability;
using SeatMonitor.User.Register.Dto;
using System.Net;
using System.Text.Json;
using Yandex.Cloud.Functions;
using Ydb.Sdk;
using Ydb.Sdk.Services.Table;
using Ydb.Sdk.Yc;

namespace SeatMonitor.User.Register;


public class Register
{
    public static async Task<HttpResponseData> Handler(HttpRequestData request, CancellationToken cancellationToken)
    {
        // Читаем тело запроса
        using var reader = new StreamReader(request.Body);
        var json = await reader.ReadToEndAsync();
        var input = JsonSerializer.Deserialize<Request>(json);

        if (input?.UserId == null)
        {
            var badResponse = request.CreateResponse(HttpStatusCode.BadRequest);
            await badResponse.WriteAsJsonAsync(new { error = "UserId is required" });
            return badResponse;
        }

        var databaseEndpoint = Environment.GetEnvironmentVariable("DATABASE_ENDPOINT");
        var databasePath = Environment.GetEnvironmentVariable("DATABASE_PATH");

        if (string.IsNullOrEmpty(databaseEndpoint) || string.IsNullOrEmpty(databasePath))
        {
            var errorResponse = request.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new { error = "Database config not set" });
            return errorResponse;
        }

        try
        {
            var credentialsProvider = new Ydb.Sdk.Yc.MetadataProvider();
            var driverConfig = new Ydb.Sdk.DriverConfig(
                endpoint: databaseEndpoint,
                database: databasePath,
                credentials: credentialsProvider
            );

            using var driver = new Ydb.Sdk.Driver(driverConfig);
            await driver.Initialize();

            var tableClient = new Ydb.Sdk.Services.Table.TableClient(driver);

            await tableClient.SessionExec(async session =>
            {
                var datetime = DateTime.UtcNow;
                var query = $@"
                UPSERT INTO `user` (id, createDateTime, editDateTime) 
                VALUES ('{input.UserId}', '{datetime:yyyy-MM-ddTHH:mm:ss}', '{datetime:yyyy-MM-ddTHH:mm:ss}');";

                return await session.ExecuteDataQuery(
                    query,
                    txControl: Ydb.Sdk.Table.TransactionControl.BeginSerializableRW().Commit()
                );
            });

            var response = request.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(new { message = $"User {input.UserId} registered successfully." });
            return response;
        }
        catch (Exception ex)
        {
            var errorResponse = request.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
            return errorResponse;
        }
    }
}

// Ваши DTO
public record Request(string UserId);
public record ApiResponse(int StatusCode, string Message);
