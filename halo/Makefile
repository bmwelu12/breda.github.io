# Halo — common tasks. The app runs with no models; these build the real ML artifacts.
.PHONY: help install dev data eval serve models test test-ml clean

help:
	@echo "Halo targets:"
	@echo "  make install   npm install (app + server + sdks)"
	@echo "  make dev       run server + web  (npm run dev)"
	@echo "  make data      build training datasets (AutoTrain format) -> ml/data/out"
	@echo "  make eval      evaluate guardian models on the gold test set -> ml/evals/results"
	@echo "  make serve     run the Python model serving service (ml/serve) on :8900"
	@echo "  make models    download fine-tuned models from private HF repos -> ml/models"
	@echo "  make test      run app tests (vitest)"
	@echo "  make test-ml   run ML tests (pytest)"

install:
	npm install

dev:
	npm run dev

data:
	cd ml/data && python3 build_all.py

eval:
	cd ml/evals && python3 eval_guardians.py

serve:
	cd ml/serve && python3 -m uvicorn app:app --host 127.0.0.1 --port 8900

# Download fine-tuned models from private HF repos ($HF_ORG/halo-<model>) into ml/models/.
models:
	@if [ -z "$$HF_TOKEN" ] || [ -z "$$HF_ORG" ]; then \
	  echo "Set HF_TOKEN and HF_ORG to download fine-tuned models. The app runs without them."; \
	else \
	  python3 ml/serve/download_models.py; \
	fi

test:
	npm test

test-ml:
	cd ml && python3 -m pytest -q

clean:
	rm -rf ml/data/out ml/models node_modules */node_modules **/dist data
