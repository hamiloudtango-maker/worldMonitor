"""Jobs API — query background task status."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _serialize(j: Job) -> dict:
    return {
        "id": j.id,
        "type": j.type,
        "target_id": j.target_id,
        "status": j.status,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        "error": j.error,
    }


@router.get("")
async def list_jobs(
    target_id: str | None = Query(None),
    type: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Job).order_by(Job.started_at.desc()).limit(limit)
    if target_id:
        stmt = stmt.where(Job.target_id == target_id)
    if type:
        stmt = stmt.where(Job.type == type)
    if status:
        stmt = stmt.where(Job.status == status)
    jobs = (await db.scalars(stmt)).all()
    return {"jobs": [_serialize(j) for j in jobs]}


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        from fastapi import HTTPException
        raise HTTPException(404, "Job not found")
    return _serialize(job)
