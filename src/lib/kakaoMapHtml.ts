export function buildKakaoMapHtml(appKey: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }</style>
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

    function renderPins(pins) {
      if (!pins || pins.length === 0) return;
      kakao.maps.load(function () {
        var container = document.getElementById('map');
        var first = pins[0];
        var center = new kakao.maps.LatLng(first.latitude, first.longitude);
        if (mapInstance === null) {
          mapInstance = new kakao.maps.Map(container, { center: center, level: 4 });
        } else {
          mapInstance.setCenter(center);
        }

        overlays.forEach(function (overlay) { overlay.setMap(null); });
        overlays = [];

        pins.forEach(function (pin, index) {
          var position = new kakao.maps.LatLng(pin.latitude, pin.longitude);
          var el = document.createElement('div');
          el.textContent = String(index + 1);
          el.style.cssText = 'width:26px;height:26px;border-radius:9999px;background:#FF6B4A;' +
            'color:#fff;display:flex;align-items:center;justify-content:center;' +
            'font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);';
          var overlay = new kakao.maps.CustomOverlay({ position: position, content: el, zIndex: 2 });
          overlay.setMap(mapInstance);
          overlays.push(overlay);
        });
      });
    }

    function handleMessage(event) {
      var pins;
      try {
        pins = JSON.parse(event.data);
      } catch (e) {
        // 무시 — 핀 데이터가 아닌 다른 메시지일 수 있음
        return;
      }
      try {
        renderPins(pins);
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
