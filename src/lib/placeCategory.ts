// Google Places API가 반환하는 원시 카테고리(예: "fast_food_restaurant")를
// 화면에 보여줄 한국어 라벨로 바꾼다. 지도를 카테고리 원문 그대로(under_score,
// 영어) 노출하면 사용자가 "이게 뭐지?" 싶어하므로, 실제로 자주 보이는 타입 위주로
// 매핑을 채워두고, 매핑에 없는 값은 언더스코어를 공백으로 바꿔서라도 원문 영어
// snake_case를 그대로 노출하지 않게 한다.
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "음식점",
  fast_food_restaurant: "패스트푸드",
  cafe: "카페",
  coffee_shop: "카페",
  bakery: "베이커리",
  bar: "술집",
  night_club: "클럽",
  ice_cream_shop: "디저트",
  dessert_shop: "디저트",
  meal_takeaway: "포장 전문점",
  meal_delivery: "배달 전문점",

  supermarket: "마트",
  hypermarket: "대형마트",
  grocery_store: "식료품점",
  food_store: "식료품점",
  convenience_store: "편의점",
  department_store: "백화점",
  shopping_mall: "쇼핑몰",
  clothing_store: "옷가게",
  book_store: "서점",
  toy_store: "장난감가게",
  home_goods_store: "생활용품점",
  electronics_store: "전자제품점",
  furniture_store: "가구점",
  jewelry_store: "액세서리점",
  shoe_store: "신발가게",
  pet_store: "펫샵",
  florist: "꽃집",

  tourist_attraction: "관광명소",
  museum: "박물관",
  history_museum: "역사박물관",
  art_gallery: "미술관",
  cultural_landmark: "문화유적지",
  historical_landmark: "유적지",
  monument: "기념물",
  park: "공원",
  national_park: "국립공원",
  amusement_park: "놀이공원",
  zoo: "동물원",
  aquarium: "수족관",
  church: "교회",
  hindu_temple: "사원",
  mosque: "모스크",
  synagogue: "유대교 회당",
  place_of_worship: "종교시설",

  lodging: "숙소",
  hotel: "호텔",
  guest_house: "게스트하우스",
  campground: "캠핑장",

  spa: "스파",
  gym: "헬스장",
  beauty_salon: "미용실",
  hair_salon: "헤어샵",
  movie_theater: "영화관",
  stadium: "경기장",
  bowling_alley: "볼링장",

  subway_station: "지하철역",
  train_station: "기차역",
  bus_station: "버스터미널",
  light_rail_station: "경전철역",
  airport: "공항",
  parking: "주차장",

  hospital: "병원",
  pharmacy: "약국",
  dentist: "치과",
  doctor: "병원",

  bank: "은행",
  atm: "ATM",
  post_office: "우체국",
  library: "도서관",
  school: "학교",
  primary_school: "초등학교",
  secondary_school: "중고등학교",
  university: "대학교",

  point_of_interest: "장소",
  establishment: "장소",
  store: "상점",
  food: "음식",
};

/** 알 수 없는 카테고리라도 영어 snake_case 원문을 그대로 노출하지 않도록,
 * 최소한 언더스코어를 공백으로 바꿔 사람이 읽기 편한 형태로 폴백한다. */
function fallbackLabel(category: string): string {
  return category
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABELS[category] ?? fallbackLabel(category);
}
