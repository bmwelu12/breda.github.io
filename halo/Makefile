.PHONY: setup data eval models test train push-data
PY ?= python3

setup:            ## install app + model-service (stub) + dev deps
	npm install
	$(PY) -m pip install -r ml/requirements-dev.txt

data:             ## build train/validation/test sets in AutoTrain format
	$(PY) ml/data/build.py

eval:             ## score every guardian model (fine-tuned vs base vs heuristic) on the frozen test set
	@test -f ml/data/processed/sentinel-fast/test.jsonl || $(PY) ml/data/build.py
	cd ml && $(PY) evals/run_eval.py

models:           ## download fine-tuned models from the private HF repos (needs HF_TOKEN, HF_ORG)
	$(PY) -m pip install -r ml/serve/requirements.txt
	$(PY) ml/download_models.py
	$(PY) ml/autotrain/capture_settings.py

push-data:        ## upload datasets to private HF dataset repos (needs HF_TOKEN, HF_ORG)
	$(PY) ml/data/push_datasets.py

train:            ## paid step: prints the AutoTrain commands; requires founder approval
	@test "$$HALO_TRAINING_APPROVED" = "yes" || (echo "Paid training needs founder approval. See PLAN.md §6, then set HALO_TRAINING_APPROVED=yes."; exit 1)
	@cat ml/autotrain/RUN.md

test:             ## all tests
	npx vitest run
	cd ml && $(PY) -m pytest -q tests
