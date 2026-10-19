-- Per-project build settings (Step 8). All nullable; null means auto-detect in the build-server.
ALTER TABLE "Project" ADD COLUMN "root_directory" TEXT;
ALTER TABLE "Project" ADD COLUMN "install_command" TEXT;
ALTER TABLE "Project" ADD COLUMN "build_command" TEXT;
ALTER TABLE "Project" ADD COLUMN "output_directory" TEXT;
ALTER TABLE "Project" ADD COLUMN "node_version" TEXT;
