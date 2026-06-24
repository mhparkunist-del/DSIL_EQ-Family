# EQUIMENT 홈페이지

산업용 장비 전문기업을 위한 간단한 정적 웹사이트 예시입니다.
순수 HTML / CSS / JavaScript로만 구성되어 별도의 빌드 과정이 없습니다.

## 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 페이지 구조 (헤더, 히어로, 제품, 회사소개, 문의, 푸터) |
| `style.css`  | 스타일 및 반응형 레이아웃 |
| `script.js`  | 모바일 메뉴 토글, 문의 폼 동작 |

## 로컬에서 보기

`index.html` 파일을 브라우저로 직접 열면 됩니다.
또는 간단한 로컬 서버를 띄울 수 있습니다.

```bash
# Python 3
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## GitHub Pages로 배포하기

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더를 push 합니다 (아래 명령 참고).
3. 저장소 **Settings → Pages** 로 이동합니다.
4. **Source**를 `main` 브랜치 / `root`로 설정하고 저장합니다.
5. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 에서 사이트가 공개됩니다.

```bash
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git branch -M main
git push -u origin main
```
