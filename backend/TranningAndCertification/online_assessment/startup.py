import logging

logger = logging.getLogger(__name__)

def init_otel():
    try:
        from online_assessment.otel import setup_otel
    except ImportError as exc:
        logger.warning("OpenTelemetry is not available; skipping setup: %s", exc)
        return

    setup_otel()
