const map = L.map('serviceMap').setView([10.7, 106.8], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

const logoIcon = L.icon({
  iconUrl: '/vn_waji_4/static/img/logo.png',
  iconSize: [36, 36],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42]
});

const khuVuc = [
  { name: 'TP.HCM', lat: 10.7769, lng: 106.7009 },
  { name: 'Bình Dương', lat: 10.9804, lng: 106.6519 },
  { name: 'Đồng Nai', lat: 10.9574, lng: 106.8427 },
  { name: 'Long An', lat: 10.6956, lng: 106.2431 },
  { name: 'Tây Ninh', lat: 11.3100, lng: 106.0983 },
  { name: 'Bà Rịa - Vũng Tàu', lat: 10.5417, lng: 107.2429 },
  { name: 'Bình Phước', lat: 11.7512, lng: 106.7235 },
  { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469 },
  { name: 'An Giang', lat: 10.5216, lng: 105.1259 },
  { name: 'Kiên Giang', lat: 10.0125, lng: 105.0809 },
  { name: 'Cà Mau', lat: 9.1769, lng: 105.1524 },
  { name: 'Bạc Liêu', lat: 9.2940, lng: 105.7216 },
  { name: 'Sóc Trăng', lat: 9.6025, lng: 105.9739 },
  { name: 'Hậu Giang', lat: 9.7845, lng: 105.4701 },
  { name: 'Vĩnh Long', lat: 10.2537, lng: 105.9722 },
  { name: 'Bến Tre', lat: 10.2434, lng: 106.3756 },
  { name: 'Tiền Giang', lat: 10.4493, lng: 106.3421 },
  { name: 'Đồng Tháp', lat: 10.4938, lng: 105.6882 },
  { name: 'Trà Vinh', lat: 9.9513, lng: 106.3346 }
];

khuVuc.forEach(item => {
  L.marker([item.lat, item.lng], { icon: logoIcon })
    .addTo(map)
    .bindPopup(`
      <b>${item.name}</b><br>
      Đục phá bê tông<br>
      Tháo dỡ công trình<br>
      Khoan cắt bê tông<br>
      Thuê máy đào<br>
      <a href="tel:0972112131">Gọi ngay</a>
    `);
});
// Keep all service locations visible in the narrower showcase column.
map.fitBounds(L.latLngBounds(khuVuc.map(item => [item.lat, item.lng])), {
  padding: [24, 24],
  maxZoom: 9
});
if (window.ResizeObserver) {
  new ResizeObserver(function () { map.invalidateSize({ pan: false }); })
    .observe(document.getElementById('serviceMap'));
}
