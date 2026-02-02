using Geniusek.Kernel.Logging;
using System.Text.Json;

namespace Geniusek.Yandex.Functions;

public class DefaultLogger(string logLevel, JsonSerializerOptions? serializerOptions = null)
: AbstractJsonLogger(logLevel, serializerOptions)
{
    protected override void Log(string key, string message, Level level)
    {
        Console.WriteLine($"{key}: {message}");
    }
}
