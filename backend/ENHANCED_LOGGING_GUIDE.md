# Enhanced Logging Configuration Guide

This guide explains the enhanced logging system that has been implemented to provide detailed, structured logging for both development and production environments.

## Overview

The enhanced logging system provides:

- **Colored console output** for development with timestamps, levels, and context
- **Structured JSON logging** for production environments
- **File-based logging** with rotation for persistent storage
- **Request/response tracing** with correlation IDs
- **Performance monitoring** and timing metrics
- **Database query logging**
- **API call tracking**
- **Error tracking with stack traces**

## Configuration

### Environment Variables

```bash
# Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=DEBUG

# Environment (development, production)
ENVIRONMENT=development

# Enable structured JSON logging (production)
# Set to 'true' for production, 'false' for development
# Defaults to 'true' when ENVIRONMENT=production
```

### File Structure

```
backend/
├── logging_config.py          # Core logging configuration
├── main.py                    # Application with enhanced logging
├── start.py                   # Startup script with enhanced logging
├── logs/                      # Log files (created automatically)
│   ├── app.log               # Main application logs
│   └── error.log             # Error-only logs
└── ENHANCED_LOGGING_GUIDE.md # This guide
```

## Log Output Examples

### Development Console Output

```bash
[14:47:27.720] [INFO] [backend.startup:<module>:93] Backend startup process initiated
[14:47:27.784] [INFO] [backend.startup:<module>:366] Creating database tables...
[14:47:27.800] [INFO] [backend.startup:<module>:457] Running database migrations...
[14:47:27.814] [INFO] [backend.startup:<module>:500] 🚀 Backend startup completed successfully!
```

### Production JSON Output

```json
{
  "timestamp": "2025-11-16T14:47:27.720Z",
  "level": "INFO",
  "logger": "backend.startup",
  "message": "Backend startup process initiated",
  "module": "start",
  "function": "<module>",
  "line": 93,
  "event_type": "startup_initiated",
  "root_dir": "/home/vstaln/hackathon",
  "python_version": "3.11.0",
  "pid": 12345
}
```

## Log Types and Events

### Startup Events

- `startup_initiated` - Application starting
- `environment_loaded` - Environment configuration loaded
- `database_setup_start` - Database connection starting
- `table_creation_start` - Creating database tables
- `table_creation_complete` - Tables created successfully
- `migrations_start` - Database migrations starting
- `migrations_complete` - Migrations completed
- `server_startup_initiated` - FastAPI server starting
- `startup_complete` - Application fully started

### Request Events

- `request_start` - HTTP request received
- `request_complete` - Request completed successfully
- `request_error` - Request failed with error

### API Events

- `api_request_start` - API call initiated
- `api_response_success_json` - Successful JSON response
- `api_response_error` - API error response
- `api_network_error` - Network connectivity error

### Database Events

- `database_connection_requested` - Database connection requested
- `database_connected` - Connection established
- `database_disconnected` - Connection closed
- `database_connection_failed` - Connection failed

### Chat Events

- `chat_request_start` - Chat request initiated
- `chat_request_complete` - Chat request completed
- `chat_request_error` - Chat request failed

## Performance Monitoring

The logging system automatically tracks:

- **Startup timing** - Total startup time and individual phases
- **Database operations** - Query execution times
- **API requests** - Request/response cycle times
- **Function performance** - When using `@log_performance` decorator

### Example Performance Log

```json
{
  "event_type": "chat_request_complete",
  "user_id": "user123",
  "conversation_id": "conv456",
  "total_time_ms": 1250,
  "response_length": 850,
  "correlation_id": "abc-123-def"
}
```

## Request Tracing

Each request is assigned a unique correlation ID that flows through:

1. **Request middleware** generates correlation ID
2. **API endpoints** include correlation ID in logs
3. **Database operations** include correlation ID
4. **External API calls** include correlation ID
5. **Error handling** includes correlation ID

This enables end-to-end request tracing across all system components.

## Log Levels

### DEBUG
- Detailed information for debugging
- SQL queries
- Request/response bodies
- Function entry/exit points

### INFO
- General application information
- Request summaries
- Configuration changes
- Successful operations

### WARNING
- Potential issues
- Deprecated features
- Configuration problems

### ERROR
- Error conditions
- Failed operations
- Exceptions with stack traces

### CRITICAL
- System failures
- Fatal errors
- Service unavailable

## Frontend Logging

The frontend API service has been enhanced with detailed logging:

```typescript
// Enable detailed API logging in development
const shouldLog = isDevEnv() || process.env.NEXT_PUBLIC_ENABLE_API_LOGGING === 'true';

// Request logging with correlation IDs
console.log('[DEBUG][ApiService.fetch:start]', {
  requestId,
  endpoint,
  url,
  method,
  eventType: 'api_request_start',
  performance_start: startTime
});
```

## Log File Management

### Automatic Rotation
- **Main logs**: 50MB max, 10 backup files
- **Error logs**: 10MB max, 5 backup files
- **UTF-8 encoding** for all log files

### File Locations
```bash
logs/app.log      # All application logs
logs/error.log    # Error-only logs
```

## Integration with External Services

### Sentry Integration (Recommended)
```python
import sentry_sdk

sentry_sdk.init(
    dsn="your-sentry-dsn",
    environment=os.getenv("ENVIRONMENT", "development"),
    traces_sample_rate=1.0,
)
```

### Log Aggregation
The structured JSON format is compatible with:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- AWS CloudWatch Logs
- Google Cloud Logging

## Custom Logging

### Creating Loggers
```python
from logging_config import create_logger

# Create a specific logger for your module
my_logger = create_logger("backend.my_module")

# Use with enhanced context
my_logger.info("Operation completed", extra={
    "event_type": "operation_complete",
    "user_id": user_id,
    "operation": "data_processing",
    "items_processed": 100
})
```

### Performance Monitoring
```python
from logging_config import log_performance

@log_performance(api_logger)
async def my_function():
    # Function execution will be timed and logged
    pass
```

### Database Query Logging
```python
from logging_config import log_database_query

log_database_query(
    logger=db_logger,
    query="SELECT * FROM users WHERE id = ?",
    params=[user_id],
    duration_ms=45.2,
    success=True
)
```

### API Call Logging
```python
from logging_config import log_api_call

log_api_call(
    logger=api_logger,
    service="openai",
    method="POST",
    url="https://api.openai.com/v1/chat/completions",
    status_code=200,
    duration_ms=1250,
    success=True
)
```

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check `LOG_LEVEL` environment variable
   - Verify `logs/` directory permissions
   - Ensure proper imports

2. **File logging not working**
   - Check disk space
   - Verify directory permissions
   - Check file rotation limits

3. **Performance impact**
   - Adjust log levels for production
   - Use structured logging only in production
   - Monitor log file sizes

### Debug Mode

Enable maximum debugging:
```bash
export LOG_LEVEL=DEBUG
export ENVIRONMENT=development
python start.py
```

## Best Practices

1. **Use structured data** in log messages via `extra` parameter
2. **Include correlation IDs** for request tracing
3. **Log at appropriate levels** (INFO for normal operation, ERROR for failures)
4. **Avoid sensitive data** in logs (passwords, tokens, PII)
5. **Monitor log file sizes** and rotation
6. **Use event types** for consistent log categorization
7. **Include timing information** for performance monitoring

## Migration from Basic Logging

The enhanced logging system is backward compatible. Existing `print()` statements and basic `logging` calls will continue to work, but you can gradually migrate them to use the enhanced features:

```python
# Old way
print("Processing user request")
logging.error("Database connection failed")

# Enhanced way
api_logger.info("Processing user request", extra={
    "event_type": "user_request_processing",
    "user_id": user_id
})

db_logger.error("Database connection failed", extra={
    "event_type": "database_connection_failed",
    "database": "users_db",
    "connection_attempts": 3,
    "exc_info": True
})
```