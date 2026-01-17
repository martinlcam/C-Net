# C-Net
A full-stack, self-hosted dashboard to monitor and manage a homelab environment, including VMs, containers, NAS storage, and popular services like Pi-hole, Plex, and Minecraft. Built with Next.js for the frontend and API, Express/TypeScript for backend logic, BullMQ for async jobs, PostgreSQL for metrics and audit logs, and Redis for job queues.

Features:

Real-time metrics and service health monitoring via WebSockets and REST API.

Full control of Proxmox VMs/LXC containers and storage pools.

Automated recurring tasks: backups, service checks, and metrics collection.

Audit logging of all infrastructure changes for transparency and debugging.

NAS integration for storage monitoring, snapshots, and media/library management.

OAuth-based authentication and encrypted service credentials.

Learning Highlights:

End-to-end full-stack development (frontend + backend + workers).

Designing and building a custom server architecture to manage real infrastructure.

Working with real APIs (Proxmox, TrueNAS) and orchestrating service communication.

Asynchronous job scheduling and queue management with BullMQ.

Real-time data streaming with WebSockets and frontend state management with Zustand + TanStack Query.

Database design for metrics, audit logs, and service health tracking.

Secure authentication flows with OAuth and encrypted credentials.

Hands-on experience with deployment, containerization, and managing a self-hosted server environment.

