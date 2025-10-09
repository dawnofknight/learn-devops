#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la backups/
    exit 1
fi

BACKUP_DATE=$1

# Stop services
docker-compose down

# Restore volume
docker run --rm -v learn-container_postgres_data:/data -v $(pwd)/backups/$BACKUP_DATE:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data

# Start database
docker-compose up -d database

# Wait for database to be ready
sleep 10

# Restore database
docker-compose exec -T database psql -U quotes_user quotes_db < backups/$BACKUP_DATE/database.sql

# Start all services
docker-compose up -d

echo "Restore completed from: backups/$BACKUP_DATE/"