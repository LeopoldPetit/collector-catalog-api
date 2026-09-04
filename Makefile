# Reproduit localement les étapes du workflow CI réutilisable
# (collector-infra/.github/workflows/reusable-lint-test-scan-build.yml)

IMAGE_NAME ?= ghcr.io/leopoldpetit/collector-catalog-api
IMAGE_TAG ?= local
SEVERITY ?= CRITICAL,HIGH
TRIVY_IMAGE ?= aquasec/trivy:latest

.PHONY: install lint test audit build trivy ci clean

install:
	npm ci

lint:
	npm run lint --if-present

test:
	npm test --if-present -- --coverage

audit:
	npm audit --omit=dev --audit-level=high

build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

# nécessite Docker ; monte le socket pour que Trivy inspecte l'image buildée localement
trivy: build
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(HOME)/.cache/trivy:/root/.cache/ \
		$(TRIVY_IMAGE) image \
		--severity $(SEVERITY) \
		--exit-code 1 \
		--ignore-unfixed \
		$(IMAGE_NAME):$(IMAGE_TAG)

ci: install lint test audit trivy

clean:
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
