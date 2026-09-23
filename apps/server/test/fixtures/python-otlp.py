import os
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http import Compression
provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint=os.environ['LLMFLOW_URL'] + '/v1/traces', compression=Compression.Gzip)))
with provider.get_tracer('real-python-sdk').start_as_current_span('python-protobuf-gzip') as span:
    span.set_attribute('gen_ai.request.model', 'python-fixture')
    print(format(span.get_span_context().span_id, '016x'))
provider.shutdown()
