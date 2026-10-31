---
license: other
license_name: halo-proprietary
private: true
language: [en]
task_categories: [text-classification, text-generation]
---
# Halo training data: {{name}}

Private training data for Halo's guardian model **{{name}}**. Built by `ml/data/build.py`.

- **Contents:** invented scam and legitimate contacts, outbound agent actions, and interrogation dialogues. No real personal data: every name, number, address and account is made up.
- **Sources:** template-composed examples (labels set by construction), open-model generated examples (Qwen/Qwen2.5-7B-Instruct, Apache-2.0) and Hub datasets with commercial licenses (see DATASETS.md). Generated and imported rows enter only after human review.
- **Splits:** train / validation here. The test split is frozen, never uploaded for training, and its row hashes are in `test_manifest.json`.
- **Defensive use only.** Includes examples of social-engineering language and instructions aimed at AI assistants, to teach detection. Contains no exploit code.
