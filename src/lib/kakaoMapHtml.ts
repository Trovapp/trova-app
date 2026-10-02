export function buildKakaoMapHtml(appKey: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    /* 핀이 위에서 톡 떨어져 착지한다 — 지도를 처음 열 때와 새 핀이 생길 때만(새로고침마다 튀지 않게). */
    @keyframes trova-drop {
      0% { transform: translateY(-18px) scale(0.6); opacity: 0; }
      60% { transform: translateY(2px) scale(1.06); opacity: 1; }
      100% { transform: none; opacity: 1; }
    }
    .trova-pin-drop { animation: trova-drop 420ms cubic-bezier(0.2, 0.8, 0.3, 1.2) both; }
    /* 선택한 핀의 고리가 은은하게 숨쉰다. */
    @keyframes trova-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.55; }
    }
    .trova-pin-pulse { animation: trova-pulse 1.8s ease-in-out infinite; }
    /* iOS "동작 줄이기"를 켜면 WebView도 이 값을 따른다. */
    @media (prefers-reduced-motion: reduce) {
      .trova-pin-drop, .trova-pin-pulse { animation: none; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false"
    onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sdk-load-error' }))"
  ></script>
  <script>
    // 메시지는 document/window 양쪽 리스너로 들어와 한 번의 post가 두 번 처리될 수 있다.
    // 그래서 지도는 한 번만 만들고, 다시 그릴 때는 이전 오버레이를 걷어낸 뒤 다시 얹는다
    // (매번 new kakao.maps.Map을 만들면 인스턴스와 오버레이가 계속 쌓여 WebView가 무거워진다).
    var mapInstance = null;
    var overlays = [];
    var polyline = null;
    var positions = {};
    var landedPinIds = {};
    var highlightOverlay = null;
    // 지도 아래쪽을 가리는 바텀시트 높이(지도 높이 대비 비율). 0이면 가림 없음.
    var bottomInsetRatio = 0;

    function bottomInsetPx() {
      return window.innerHeight * bottomInsetRatio;
    }

    // position이 "보이는 영역"(바텀시트 위)의 가운데에 오도록 하는 지도 중심 좌표.
    // 지도 중심을 핀보다 (가림 높이 / 2)만큼 아래로 내리면 핀이 그만큼 위로 올라간다.
    function centerForVisible(position) {
      var inset = bottomInsetPx();
      if (inset <= 0) return position;
      mapInstance.setCenter(position);
      var projection = mapInstance.getProjection();
      var point = projection.containerPointFromCoords(position);
      return projection.coordsFromContainerPoint(new kakao.maps.Point(point.x, point.y + inset / 2));
    }

    // 웹(KakaoMap.tsx)의 선택 하이라이트를 그대로 이식 — 반투명 배경 + 테두리 링.
    function buildHighlightHtml() {
      return '<div class="trova-pin-pulse" style="width:28px;height:28px;border-radius:9999px;background:#FF6B4A48;border:2px solid #FF6B4A;"></div>';
    }

    function applySelection(selectedId) {
      if (!highlightOverlay || !mapInstance) return;
      var position = selectedId ? positions[selectedId] : null;
      if (!position) {
        highlightOverlay.setMap(null);
        return;
      }
      mapInstance.panTo(centerForVisible(position));
      highlightOverlay.setPosition(position);
      highlightOverlay.setMap(mapInstance);
    }

    // 핀이 하나도 없을 때(풀스크린 지도의 빈 폴더 등) 처음 보여줄 위치 — 서울시청.
    var DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

    function clearPins() {
      overlays.forEach(function (overlay) { overlay.setMap(null); });
      overlays = [];
      if (polyline) {
        polyline.setMap(null);
        polyline = null;
      }
      positions = {};
      if (highlightOverlay) highlightOverlay.setMap(null);
    }

    function renderPins(pins, selectedId, showPath, numbered) {
      pins = pins || [];
      kakao.maps.load(function () {
        var container = document.getElementById('map');
        var first = pins.length > 0 ? pins[0] : DEFAULT_CENTER;
        var center = new kakao.maps.LatLng(first.latitude, first.longitude);
        if (mapInstance === null) {
          mapInstance = new kakao.maps.Map(container, { center: center, level: pins.length > 0 ? 4 : 7 });
        }

        // 핀이 비면 지도는 그대로 두고(보던 위치 유지) 이전 핀만 걷어낸다.
        clearPins();
        if (pins.length === 0) return;

        var path = pins.map(function (pin) {
          return new kakao.maps.LatLng(pin.latitude, pin.longitude);
        });

        if (path.length > 1) {
          // 핀이 여러 개면 전부 화면 안에 들어오게 맞춘다 — 첫 핀만 가운데 두면 나머지 핀과
          // 동선이 화면 밖으로 나간다(영상 속 장소/여행 상세의 작은 지도에서도 마찬가지).
          // 풀스크린 지도는 바텀시트가 가리는 만큼 아래 여백을 더 준다.
          var bounds = new kakao.maps.LatLngBounds();
          path.forEach(function (latLng) { bounds.extend(latLng); });
          if (bottomInsetRatio > 0) {
            mapInstance.setBounds(bounds, 48, 32, bottomInsetPx() + 32, 32);
          } else {
            // 핀(26px)이 가장자리에서 잘리지 않을 만큼만 여백.
            mapInstance.setBounds(bounds, 28, 28, 28, 28);
          }
        } else {
          // 풀스크린 지도에서 핀이 하나면 "핀에 맞추기"와 같게 기본 확대 수준으로 돌린다
          // (빈 폴더에서 넓게 보던 수준 7이 그대로 남지 않도록).
          if (bottomInsetRatio > 0) mapInstance.setLevel(4);
          mapInstance.setCenter(centerForVisible(center));
        }

        positions = {};
        // 이미 한 번 착지한 핀은 다시 튀지 않는다. 처음 열 때는 차례로, 이후엔 새로 생긴 핀만 떨어진다.
        var firstRender = Object.keys(landedPinIds).length === 0;
        pins.forEach(function (pin, index) {
          var position = path[index];
          var pinColor = pin.color || '#FF6B4A';
          positions[pin.id] = position;
          var el = document.createElement('div');
          if (numbered) {
            // 호출부가 번호(label)를 주면 그대로 쓴다 — 목록 행 번호와 맞추기 위해서(좌표 없는 장소가 끼면 순서가 어긋남).
            el.textContent = pin.label != null ? String(pin.label) : String(index + 1);
            el.style.cssText = 'width:26px;height:26px;border-radius:9999px;background:' + pinColor + ';' +
              'color:#fff;display:flex;align-items:center;justify-content:center;' +
              'font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);';
          } else {
            // 순서가 없는 핀(찜한 장소 전체 보기)은 숫자 없이 색 점으로 — 숫자가 순서인지 개수인지 헷갈렸다(2026-10 QA).
            el.style.cssText = 'width:16px;height:16px;border-radius:9999px;background:' + pinColor + ';' +
              'border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);';
          }
          if (!landedPinIds[pin.id]) {
            el.className = 'trova-pin-drop';
            el.style.animationDelay = (firstRender ? Math.min(index, 12) * 50 : 0) + 'ms';
            landedPinIds[pin.id] = true;
          }
          var overlay = new kakao.maps.CustomOverlay({ position: position, content: el, zIndex: 2 });
          overlay.setMap(mapInstance);
          overlays.push(overlay);
        });

        // 웹(KakaoMap.tsx)의 동선 선 스타일을 그대로 이식 — strokeWeight/strokeColor/strokeOpacity 동일.
        if (showPath && path.length > 1) {
          polyline = new kakao.maps.Polyline({
            path: path,
            strokeWeight: 3,
            strokeColor: '#FF6B4A',
            strokeOpacity: 0.8,
          });
          polyline.setMap(mapInstance);
        }

        if (highlightOverlay === null) {
          highlightOverlay = new kakao.maps.CustomOverlay({
            position: center,
            content: buildHighlightHtml(),
            zIndex: 1,
          });
        }
        applySelection(selectedId);
      });
    }

    function handleMessage(event) {
      var payload;
      try {
        payload = JSON.parse(event.data);
      } catch (e) {
        // 무시 — 핀 데이터가 아닌 다른 메시지일 수 있음
        return;
      }
      try {
        bottomInsetRatio = payload.bottomInsetRatio || 0;
        renderPins(payload.pins, payload.selectedId, payload.showPath !== false, payload.numbered !== false);
      } catch (e) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'render-error', message: String(e && e.message) })
        );
      }
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>
  `;
}
