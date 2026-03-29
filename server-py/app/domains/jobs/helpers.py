"""Job lifecycle helpers — used by background tasks to record status."""

from datetime import datetime, timezone

from app.db import async_session
from app.models.job import Job


async def start_job(job_type: str, target_id: str | None = None) -> str:
    """Create a running job record. Returns the job ID."""
    async with async_session() as db:
        job = Job(
            type=job_type,
            target_id=target_id,
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.commit()
        return job.id


async def finish_job(job_id: str, error: str | None = None) -> None:
    """Mark a job as done or failed."""
    async with async_session() as db:
        job = await db.get(Job, job_id)
        if not job:
            return
        job.status = "failed" if error else "done"
        job.completed_at = datetime.now(timezone.utc)
        job.error = error
        await db.commit()
