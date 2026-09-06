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
  <script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false"></script>
  <script>
    function renderPins(pins) {
      kakao.maps.load(function () {
        var container = document.getElementById('map');
        var first = pins[0];
        var center = new kakao.maps.LatLng(first.latitude, first.longitude);
        var map = new kakao.maps.Map(container, { center: center, level: 4 });

        pins.forEach(function (pin, index) {
          var position = new kakao.maps.LatLng(pin.latitude, pin.longitude);
          var el = document.createElement('div');
          el.textContent = String(index + 1);
          el.style.cssText = 'width:26px;height:26px;border-radius:9999px;background:#FF6B4A;' +
            'color:#fff;display:flex;align-items:center;justify-content:center;' +
            'font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);';
          new kakao.maps.CustomOverlay({ position: position, content: el, zIndex: 2 }).setMap(map);
        });
      });
    }

    function handleMessage(event) {
      try {
        var pins = JSON.parse(event.data);
        renderPins(pins);
      } catch (e) {
        // 무시 — 핀 데이터가 아닌 다른 메시지일 수 있음
      }
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>
  `;
}
