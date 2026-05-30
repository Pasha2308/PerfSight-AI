from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Float, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspaces = relationship("Workspace", back_populates="owner")
    test_runs = relationship("TestRun", back_populates="user")

class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="workspaces")
    test_runs = relationship("TestRun", back_populates="workspace")

class TestRun(Base):
    __tablename__ = "test_runs"
    id = Column(String, primary_key=True, index=True)
    project_name = Column(String)
    target_url = Column(String)
    scenario_type = Column(String)
    tool = Column(String)
    status = Column(String, default="pending")
    generated_script = Column(Text)
    metrics_json = Column(Text)
    findings_json = Column(Text)
    report_json = Column(Text)
    nl_description = Column(Text)
    
    user_id = Column(String, ForeignKey("users.id"))
    workspace_id = Column(String, ForeignKey("workspaces.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="test_runs")
    workspace = relationship("Workspace", back_populates="test_runs")
