# MegaLook-CIIP_Guide_Result_Dashboard

CIIP 점검 스크립트 결과를 한눈에 보기 위한 대시보드 프로젝트입니다. MegaLook 기반 점검 결과(CSV)를 수집하고, 항목별 준수 여부와 요약 지표를 시각화하는 것을 목표로 합니다.

## Goals
- 점검 결과를 표/요약 지표 형태로 빠르게 확인
- 대분류/중분류/항목별 상태 집계
- 장비/시스템별 결과 비교
- 리포팅을 위한 데이터 정리 및 재사용 가능 구조

## Structure
- `Content/`: 기준 체크리스트 및 기준 데이터
- `Result/`: 점검 결과 CSV (참고용, 현재는 업로드 방식)

## Run
로컬 서버로 실행해야 `Content`를 정상적으로 읽습니다.
```bash
cd /Users/young/DEV/MegaLook-CIIP_Guide_Result_Dashboard
python3 -m http.server 5173
```
브라우저에서 `http://localhost:5173` 접속

## Result 데이터 로딩
- 상단 `Result 폴더`에서 결과 CSV가 들어있는 폴더를 선택
- 선택된 CSV들은 브라우저에서만 처리되며 서버로 전송되지 않음

## Notes
- `Content/CIIP Checklist.csv`는 서버에 정적으로 두고 읽습니다.
- Result 업로드 전에는 대시보드/프로젝트에 안내 메시지가 표시됩니다.

## Expected Input
- MegaLook 점검 결과 CSV (시스템/장비별)
- CIIP 체크리스트 CSV

## Output (Planned)
- 통합 요약 대시보드
- 항목별 준수/미준수 현황
- 시스템별 비교/필터링

---

## Version History
- v0.1 (2026-02-20)
  - 초기 구조 구성 및 데이터 수집 준비
- v0.2 (2026-02-21)
  - 대시보드/프로젝트 화면 레이아웃 구성
  - Content + Result 연동 구조 정리 및 매칭 로직 반영
  - Result 폴더 업로드 방식 적용(로컬 처리)
  - 업로드 전 안내 메시지 추가
  - 프로젝트 선택 UX 개선(전환/비활성 상태)
  - 개인정보/전송 없음 툴팁 안내 추가
  - README 실행/사용 안내 업데이트
