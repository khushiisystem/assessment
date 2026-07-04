from opentelemetry import trace

tracer = trace.get_tracer(__name__)

class OTelMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        with tracer.start_as_current_span(
            f"{request.method} {request.path}"
        ) as span:

            span.set_attribute("http.method", request.method)
            span.set_attribute("http.url", request.build_absolute_uri())

            response = self.get_response(request)

            span.set_attribute("http.status_code", response.status_code)

            return response