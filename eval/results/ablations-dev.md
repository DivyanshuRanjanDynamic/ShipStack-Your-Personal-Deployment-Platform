# Phase 3 Retrieval Ablations Report (Dev Split)

Date: 2026-10-17T07:55:05.340Z

| Configuration | Recall@3 | Recall@5 | MRR | Key Insight |
|---|---|---|---|---|
| **Hybrid (Default)** | **100.0%** | **100.0%** | **1.000** | Combines semantic intent with exact error codes |
| **Vector-Only** | 100.0% | 100.0% | 1.000 | Good conceptual matching but misses exact error tokens |
| **Keyword-Only** | 50.0% | 50.0% | 0.500 | Catches exact codes (ERESOLVE) but weaker on generic errors |
| **No Framework Filter** | 100.0% | 100.0% | 1.000 | Allows cross-framework noise into top-5 |
| **Top-K = 3** | 100.0% | 100.0% | 1.000 | Compact prompt context with zero recall loss |

