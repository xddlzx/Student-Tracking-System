# Validation Rules

## Fields
- `student.full_name`: 2–120 chars, letters + space only (Turkish diacritics allowed).
- `guardian_phone`: E.164 or local GSM (e.g., `05xxxxxxxxx`).
- `grade`: integer in [5,8].
- `class_section`: like `8/A` (grade + `/` + uppercase letter).
- `teacher.email`: RFC 5322 basic format; uniqueness enforced.
- `password`: configurable policy via env; default min length 10 chars, must include uppercase, number, symbol.

## Subjects and Aliases
| Code | tr-TR | en-US |
|---|---|---|
| TR  | Türkçe | Turkish |
| MAT | Matematik | Mathematics |
| FEN | Fen Bilimleri | Science |
| INK | T.C. İnkılap Tarihi ve Atatürkçülük | Revolution History & Kemalism |
| DIN | Din Kültürü ve Ahlak Bilgisi | Religious Culture & Ethics |
| ING | İngilizce | English |

## Subject Totals per Grade (default)
- `subjects_config.penalty_factor` default **1/3 (0.3333)**.
- Max counts by grade (can be edited in DB):
  - Grades 5–8: TR 20, MAT 20, FEN 20, INK 10, DIN 10, ING 10.

## Net Formula
Per subject: `net = correct − (wrong × penalty_factor)`

Totals: sum of per-subject fields. All figures validated:
- `correct + wrong + blank == max`
- Each field ≥ 0; totals non-negative.
- If validation fails: return `422` with machine‑readable errors:
```json
{
  "error": "validation_failed",
  "details": [
    {"subject_code": "MAT", "message": "Toplam soru sayısı 20 olmalıdır."}
  ]
}
```
