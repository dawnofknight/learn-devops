#!/bin/bash

# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup database
docker-compose exec -T database pg_dump -U quotes_user quotes_db > backups/$(date +%Y%m%d)/database.sql

# Backup volumes
docker run --rm -v learn-container_postgres_data:/data -v $(pwd)/backups/$(date +%Y%m%d):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .

echo "Backup completed: backups/$(date +%Y%m%d)/"