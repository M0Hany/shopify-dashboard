// Types for location data
export interface SubZone {
  Id: number;
  Code: string;
  ArName: string;
  EnName: string;
}

export interface Zone {
  Id: number;
  EnName: string;
  ArName: string;
  SubZoneId: number;
  SubZones: SubZone[];
}

export interface City {
  Id: number;
  EnName: string;
  ArName: string;
  Zones: Zone[];
}

export interface LocationResponse {
  Value: City[];
}

// Helper functions
export const getLocationIds = (governorate: string, locationData: LocationResponse): { 
  cityId: string | null;
  neighborhoodId: string | null;
  subZoneId: string | null;
} => {
  const normalizedGovernorate = governorate.trim().toLowerCase();
  const city = locationData.Value.find(
    city => city.EnName.toLowerCase() === normalizedGovernorate || 
           city.ArName === governorate
  );

  if (!city) {
    console.warn(`Unknown governorate: ${governorate}`);
    return {
      cityId: null,
      neighborhoodId: null,
      subZoneId: null
    };
  }

  return {
    cityId: city.Id.toString(),
    neighborhoodId: null,
    subZoneId: null
  };
};

// This data is from the Mylerz API GetAllPickup endpoint
export const locationData: LocationResponse = {
  "Value": [
    {
      "Id": 1,
      "EnName": "Cairo",
      "ArName": "القاهرة",
      "Zones": [
        {
          "Id": 5,
          "EnName": "Ain Shams",
          "ArName": "عين شمس",
          "SubZoneId": 7,
          "SubZones": [
            {
              "Id": 7,
              "Code": "AS",
              "ArName": "عين شمس",
              "EnName": "Ain Shams"
            },
            {
              "Id": 10,
              "Code": "AS-AE",
              "ArName": "عين شمس احمد عصمت",
              "EnName": "Ain Shams-Ahmed Esmat"
            },
            {
              "Id": 11,
              "Code": "AS-Naam",
              "ArName": "عين شمس النعام",
              "EnName": "Ain Shams-Al Naam"
            },
            {
              "Id": 18,
              "Code": "AS_Elzahraa",
              "ArName": "عين شمس مدينة الزهراء",
              "EnName": "Ain Shams-El Zahraa City"
            },
            {
              "Id": 22,
              "Code": "AS-Ibrahim Abdel El-Razik",
              "ArName": "عين شمس ابراهيم عبدالرازق",
              "EnName": "Ain Shams-Ibrahim Abd El-Razik"
            },
            {
              "Id": 23,
              "Code": "AS-Manshya El tahrir",
              "ArName": "عين شمس منشيه التحرير",
              "EnName": "Ain Shams-Mansheya El-Tahrir"
            },
            {
              "Id": 27,
              "Code": "AS-Mostafa Hafez",
              "ArName": "عين شمس مصطفي حافظ",
              "EnName": "Ain Shams-Mostafa Hafez"
            },
            {
              "Id": 28,
              "Code": "AS-Al Sad Al Aali Cairo",
              "ArName": "السد العالي القاهره",
              "EnName": "Al Sad Al Aali Cairo"
            }
          ]
        },
        {
          "Id": 31,
          "EnName": "Al Salam",
          "ArName": "السلام",
          "SubZoneId": 32,
          "SubZones": [
            {
              "Id": 32,
              "Code": "AL-S City",
              "ArName": "مدينة السلام",
              "EnName": "Al Salam City"
            }
          ]
        },
        {
          "Id": 33,
          "EnName": "El Marg",
          "ArName": "المرج",
          "SubZoneId": 34,
          "SubZones": [
            {
              "Id": 34,
              "Code": "El-M Berket Al Hag",
              "ArName": "المرج بركة الحاج",
              "EnName": "El Marg-Berket Al Hag"
            },
            {
              "Id": 35,
              "Code": "EL-M knesa w El Gadeada",
              "ArName": "المرج الكنيسه الجديده",
              "EnName": "El Marg-EL knesa w El Gadeda"
            },
            {
              "Id": 37,
              "Code": "El-M El Rashash",
              "ArName": "المرج الرشاش",
              "EnName": "El Marg-El-Rashah"
            },
            {
              "Id": 38,
              "Code": "El-M Kafr El-shorafa",
              "ArName": "المرج كفر الشرفاء",
              "EnName": "El Marg-Kafr El-Shorafa"
            },
            {
              "Id": 39,
              "Code": "El-M Mosset Al Zakah",
              "ArName": "المرج مؤسسة الزكاه",
              "EnName": "El Marg-Mosset Al Zakah"
            },
            {
              "Id": 40,
              "Code": "El-M New",
              "ArName": "المرج الجديده",
              "EnName": "New El-Marg"
            }
          ]
        },
        {
          "Id": 41,
          "EnName": "Heliopolis",
          "ArName": "هيليوبلس",
          "SubZoneId": 42,
          "SubZones": [
            {
              "Id": 42,
              "Code": "HEl-Al Ismailia SQ",
              "ArName": "هيليوبلس ميدان الاسماعيليه",
              "EnName": "Heliopolis- Al-Ismailia Square"
            },
            {
              "Id": 43,
              "Code": "HEl-ABadwi",
              "ArName": "هيليوبلس عبدالحميد بدوي",
              "EnName": "Heliopolis-Abd El-Hameed Badawi"
            },
            {
              "Id": 45,
              "Code": "HEL-El mahkma SQ",
              "ArName": "هيليوبلس ميدان المحكمه",
              "EnName": "Heliopolis-Al Mahkama Square"
            },
            {
              "Id": 46,
              "Code": "HEL-Almaza",
              "ArName": "هيليوبلس الماظه",
              "EnName": "Heliopolis-Almaza"
            },
            {
              "Id": 48,
              "Code": "HEl-Elmoltaka El Ar",
              "ArName": "هيليوبلس الملتقي العربي",
              "EnName": "Heliopolis-Almoltaka Alarabi"
            },
            {
              "Id": 50,
              "Code": "HEl-Ard Golf",
              "ArName": "هيليوبلس ارض الجولف",
              "EnName": "Heliopolis-Ard El-Gol"
            },
            {
              "Id": 51,
              "Code": "HEL-ObourBuilding",
              "ArName": "هيليوبلس عمارات العبور",
              "EnName": "Heliopolis-El Obour Buildings"
            },
            {
              "Id": 52,
              "Code": "HEL-Orouba",
              "ArName": "هيليوبلس العروبه",
              "EnName": "Heliopolis-El Oroba"
            },
            {
              "Id": 53,
              "Code": "HEL-Hegaz SQ",
              "ArName": "هيليوبلس ميدان الحجاز",
              "EnName": "Heliopolis-El-Higaz Square"
            },
            {
              "Id": 54,
              "Code": "HEL-Thawra St",
              "ArName": "هيليوبلس شارع الثوره",
              "EnName": "Heliopolis-El-Thawra Street"
            },
            {
              "Id": 55,
              "Code": "HEL-Masr lel Tiran Build",
              "ArName": "هيليوبلس مساكن مصر للطيران",
              "EnName": "Heliopolis-Masr LEl Tiaran buildings"
            },
            {
              "Id": 57,
              "Code": "HEL-Misr lelTameer",
              "ArName": "هيليوبلس مصر للتعمير ",
              "EnName": "Heliopolis-Misr LelTameer"
            },
            {
              "Id": 58,
              "Code": "HEL-Mhamed Kamel",
              "ArName": "هيليوبلس محمد كامل حسين",
              "EnName": "Heliopolis-Mohammed Kamel Hussei"
            },
            {
              "Id": 60,
              "Code": "HEL-Roxy SQ",
              "ArName": "هيليوبلس ميدان روكسي",
              "EnName": "Heliopolis-Roxy Square"
            },
            {
              "Id": 61,
              "Code": "HEL-Siant FatimaSQ",
              "ArName": "هيليوبلس ميدان سانتا فاتيما",
              "EnName": "Heliopolis-Saint Fatima Square"
            },
            {
              "Id": 62,
              "Code": "HEL-Sakr Koresh Sheratoon",
              "ArName": "هيليوبلس صقر قريش شيراتون",
              "EnName": "Heliopolis-Saqr Korayesh Sheraton"
            },
            {
              "Id": 64,
              "Code": "HEL-Taha Huessen",
              "ArName": "هيليوبلس محور طه حسين",
              "EnName": "Heliopolis-Taha Hussen Axis"
            },
            {
              "Id": 65,
              "Code": "HEL-Triumph Square",
              "ArName": "هيليوبلس ميدان تريمف",
              "EnName": "Heliopolis-Triumph Square"
            }
          ]
        },
        {
          "Id": 66,
          "EnName": "Nozha",
          "ArName": "النزهه",
          "SubZoneId": 67,
          "SubZones": [
            {
              "Id": 67,
              "Code": "Hayksteb",
              "ArName": "الهايكستب",
              "EnName": "Hayksteb"
            },
            {
              "Id": 69,
              "Code": "Heliopolis-Cairo Airport",
              "ArName": "هيليوبلس مطار القاهره",
              "EnName": "Heliopolis-Cairo Airport"
            },
            {
              "Id": 70,
              "Code": "Heliopolis-Masaken Sheraton",
              "ArName": "هيليوبلس مساكن شيراتون",
              "EnName": "Heliopolis-Masaken Sheraton"
            },
            {
              "Id": 71,
              "Code": "Heliopolis-New Nozha",
              "ArName": "هيليوبلس النزهه الجديده",
              "EnName": "Heliopolis-New Nozha"
            }
          ]
        },
        {
          "Id": 72,
          "EnName": "Nasr City",
          "ArName": "مدينة نصر ",
          "SubZoneId": 73,
          "SubZones": [
            {
              "Id": 73,
              "Code": "Ezbt Elhagana",
              "ArName": "عزبه الهجانه",
              "EnName": "Ezbt Elhagana"
            },
            {
              "Id": 74,
              "Code": "Nasr City Al Hay Al Asher",
              "ArName": "مدينة نصر الحي العاشر",
              "EnName": "Nasr City Al Hay Al Asher"
            },
            {
              "Id": 75,
              "Code": "Nasr City Al Manteqah Al Oula",
              "ArName": "مدينة نصر المنطقه الاولي",
              "EnName": "Nasr City Al Manteqah Al Oula"
            },
            {
              "Id": 76,
              "Code": "Nasr City Al Manteqah Al Sadesah",
              "ArName": "مدينة نصر المنطقه السادسه",
              "EnName": "Nasr City Al Manteqah Al Sadesah"
            },
            {
              "Id": 77,
              "Code": "Nasr City Al Manteqah Al Thamenah",
              "ArName": "مدينة نصر المنطقه الثامنه",
              "EnName": "Nasr City Al Manteqah Al Thamenah"
            },
            {
              "Id": 78,
              "Code": "Nasr City El Hay El Sabea",
              "ArName": "مدينة نصر الحي السابع",
              "EnName": "Nasr City El Hay El Sabea"
            },
            {
              "Id": 80,
              "Code": "Nasr City El Hay El Tamen",
              "ArName": "مدينة نصر الحي الثامن ",
              "EnName": "Nasr City El Hay El Tamen"
            },
            {
              "Id": 81,
              "Code": "Nasr City-Al TOB Al Ramli",
              "ArName": "مدينة نصر الطوب الرملي",
              "EnName": "Nasr City-Al TOB Al Ramli"
            },
            {
              "Id": 82,
              "Code": "Nasr City-Al Wafaa W Al Amal City",
              "ArName": "مدينة نصر الوفاء والامل",
              "EnName": "Nasr City-Al Wafaa W Al Amal City"
            },
            {
              "Id": 83,
              "Code": "Nasr City-Waha District",
              "ArName": "مدينة نصر خي الواحه",
              "EnName": "Nasr City-Waha District"
            },
            {
              "Id": 84,
              "Code": "Nady Elsekka Elhadeed",
              "ArName": "نادي السكه الحديد",
              "EnName": "Nady Elsekka Elhadeed"
            },
            {
              "Id": 85,
              "Code": "Nasr City-Zahraa Nasr City",
              "ArName": "زهراء مدينة نصر",
              "EnName": "Nasr City-Zahraa Nasr City"
            }
          ]
        },
        {
          "Id": 86,
          "EnName": "Zamalek",
          "ArName": "الزمالك",
          "SubZoneId": 87,
          "SubZones": [
            {
              "Id": 87,
              "Code": "Abou Elfeda",
              "ArName": "ابو الفدا",
              "EnName": "Abou Elfeda"
            },
            {
              "Id": 88,
              "Code": "Gabalaya",
              "ArName": "الجبلايه",
              "EnName": "Gabalaya"
            },
            {
              "Id": 89,
              "Code": "Mohamed Mazhar",
              "ArName": "محمد مظهر",
              "EnName": "Mohamed Mazhar"
            },
            {
              "Id": 90,
              "Code": "Zamalek",
              "ArName": "الزمالك",
              "EnName": "Zamalek"
            }
          ]
        },
        {
          "Id": 91,
          "EnName": "El Azbakia",
          "ArName": "الازبكيه",
          "SubZoneId": 92,
          "SubZones": [
            {
              "Id": 92,
              "Code": "Down Town-El Azbakeya",
              "ArName": "وسط البلد الازبكيه",
              "EnName": "Down Town-El Azbakeya"
            },
            {
              "Id": 93,
              "Code": "Elgayara",
              "ArName": "الجيارا",
              "EnName": "Elgayara"
            },
            {
              "Id": 94,
              "Code": "Elrehany",
              "ArName": "الرحاني",
              "EnName": "Elrehany"
            },
            {
              "Id": 95,
              "Code": "DownTown-El Fagala",
              "ArName": "وسط البلد الفجاله",
              "EnName": "DownTown-El Fagala"
            },
            {
              "Id": 96,
              "Code": "Elqollaly",
              "ArName": "القللي",
              "EnName": "Elqollaly"
            },
            {
              "Id": 97,
              "Code": "Eltorgoman",
              "ArName": "الترجمان",
              "EnName": "Eltorgoman"
            },
            {
              "Id": 98,
              "Code": "Elahmadein",
              "ArName": "الاحمدين",
              "EnName": "Elahmadein"
            },
            {
              "Id": 99,
              "Code": "Elgaladeen",
              "ArName": "الجلادين",
              "EnName": "Elgaladeen"
            },
            {
              "Id": 100,
              "Code": "DownTown-Al Sabtia",
              "ArName": "السبتيه وسط البلد",
              "EnName": "DownTown-Al Sabtia"
            }
          ]
        },
        {
          "Id": 101,
          "EnName": "El Mosky",
          "ArName": "الموسكي",
          "SubZoneId": 102,
          "SubZones": [
            {
              "Id": 102,
              "Code": "DownTown-Al Moski",
              "ArName": "الموسكي وسط البلد",
              "EnName": "DownTown-Al Moski"
            }
          ]
        },
        {
          "Id": 103,
          "EnName": "El Waily",
          "ArName": "الوايلي",
          "SubZoneId": 2012,
          "SubZones": [
            {
              "Id": 2012,
              "Code": "El-Waily",
              "ArName": "الوايلى",
              "EnName": "El Waily"
            }
          ]
        },
        {
          "Id": 104,
          "EnName": "Abdeen",
          "ArName": "عابدين",
          "SubZoneId": 105,
          "SubZones": [
            {
              "Id": 105,
              "Code": "Down Town-Abdeen",
              "ArName": "وسط البلد عابدين",
              "EnName": "Down Town-Abdeen"
            },
            {
              "Id": 107,
              "Code": "Down Town-Bab al-Louq",
              "ArName": "وسط البلد باب اللوق",
              "EnName": "Down Town-Bab al-Louq"
            }
          ]
        },
        {
          "Id": 108,
          "EnName": "Bab El-Shaeria",
          "ArName": "باب الشعريه",
          "SubZoneId": 109,
          "SubZones": [
            {
              "Id": 109,
              "Code": "DownTown-Bab El Shaeria",
              "ArName": "وسط البلد باب الشعريه",
              "EnName": "DownTown-Bab El Shaeria"
            }
          ]
        },
        {
          "Id": 111,
          "EnName": "El Gamalia",
          "ArName": "الجماليه",
          "SubZoneId": 112,
          "SubZones": [
            {
              "Id": 112,
              "Code": "Al Azhar",
              "ArName": "الازهر",
              "EnName": "Al Azhar"
            },
            {
              "Id": 113,
              "Code": "Al-Hussein",
              "ArName": "الحسين",
              "EnName": "Al-Hussein"
            },
            {
              "Id": 114,
              "Code": "El Darasa",
              "ArName": "الدراسه",
              "EnName": "El Darasa"
            },
            {
              "Id": 115,
              "Code": "El Gamalia",
              "ArName": "الجماليه",
              "EnName": "El Gamalia"
            }
          ]
        },
        {
          "Id": 116,
          "EnName": "Boulak",
          "ArName": "بولاق",
          "SubZoneId": 117,
          "SubZones": [
            {
              "Id": 117,
              "Code": "DownTown-Boulak Abo el Eila",
              "ArName": "وسط البلد بولاق ابو العلا",
              "EnName": "DownTown-Boulak Abo el Eila"
            },
            {
              "Id": 119,
              "Code": "Darb Nasr",
              "ArName": "درب نصر",
              "EnName": "Darb Nasr"
            },
            {
              "Id": 121,
              "Code": "Souq Elasr",
              "ArName": "سوق العصر",
              "EnName": "Souq Elasr"
            }
          ]
        },
        {
          "Id": 141,
          "EnName": "Qasr elneil",
          "ArName": "قصر النيل",
          "SubZoneId": 142,
          "SubZones": [
            {
              "Id": 142,
              "Code": "Qasr elneil",
              "ArName": "قصر النيل",
              "EnName": "Qasr elneil"
            },
            {
              "Id": 145,
              "Code": "Maarouf",
              "ArName": "معرووف",
              "EnName": "Maarouf"
            },
            {
              "Id": 146,
              "Code": "Qasr Eldobara",
              "ArName": "قصر الدباره",
              "EnName": "Qasr Eldobara"
            },
            {
              "Id": 148,
              "Code": "Garden City",
              "ArName": "جاردن سيتي",
              "EnName": "Garden City"
            }
          ]
        },
        {
          "Id": 149,
          "EnName": "ELdarb Elahmar",
          "ArName": "الدرب الاحمر",
          "SubZoneId": 150,
          "SubZones": [
            {
              "Id": 150,
              "Code": "Batneya",
              "ArName": "الباطنيه",
              "EnName": "Batneya"
            },
            {
              "Id": 152,
              "Code": "Elghoreya",
              "ArName": "الغوريه",
              "EnName": "Elghoreya"
            },
            {
              "Id": 153,
              "Code": "Souq Elselah",
              "ArName": "سوق السلاح",
              "EnName": "Souq Elselah"
            },
            {
              "Id": 154,
              "Code": "Haret Elrom",
              "ArName": "حارة الروم",
              "EnName": "Haret Elrom"
            },
            {
              "Id": 155,
              "Code": "Darb Saada",
              "ArName": "درب سعاده",
              "EnName": "Darb Saada"
            },
            {
              "Id": 156,
              "Code": "Elmegharbleen",
              "ArName": "المغربليين",
              "EnName": "Elmegharbleen"
            },
            {
              "Id": 157,
              "Code": "Bab Elwazeer",
              "ArName": "باب الوزير",
              "EnName": "Bab Elwazeer"
            },
            {
              "Id": 158,
              "Code": "Eldarb Elahmar",
              "ArName": "الدرب الاحمر",
              "EnName": "Eldarb Elahmar"
            }
          ]
        },
        {
          "Id": 159,
          "EnName": "Badr City",
          "ArName": "مدينة بدر",
          "SubZoneId": 160,
          "SubZones": [
            {
              "Id": 160,
              "Code": "Badr City",
              "ArName": "مدينة بدر",
              "EnName": "Badr City"
            },
            {
              "Id": 161,
              "Code": "Badr City-Badr City Industrial Area",
              "ArName": "مدينة بدر المنطقه الصناعيه",
              "EnName": "Badr City-Badr City Industrial Area"
            }
          ]
        },
        {
          "Id": 162,
          "EnName": "Basateen",
          "ArName": "البساتين",
          "SubZoneId": 163,
          "SubZones": [
            {
              "Id": 163,
              "Code": "Basateen",
              "ArName": "البساتين",
              "EnName": "Basateen"
            },
            {
              "Id": 164,
              "Code": "Ezbet Gebreel",
              "ArName": "عزبة جبريل",
              "EnName": "Ezbet Gebreel"
            },
            {
              "Id": 165,
              "Code": "Basateen-Ber Om Soultan",
              "ArName": "البساتين بير ام سلطان",
              "EnName": "Basateen-Ber Om Soultan"
            },
            {
              "Id": 166,
              "Code": "Basateen-Fayda Kamel",
              "ArName": "البساطين فايده كامل",
              "EnName": "Basateen-Fayda Kamel"
            },
            {
              "Id": 167,
              "Code": "Ezbet Fahmy",
              "ArName": "عزبة فهمي",
              "EnName": "Ezbet Fahmy"
            },
            {
              "Id": 168,
              "Code": "Ezbet Nafea",
              "ArName": "عزبة نافع",
              "EnName": "Ezbet Nafea"
            }
          ]
        },
        {
          "Id": 174,
          "EnName": "Elsayeda Zeinab",
          "ArName": "السيده زينب",
          "SubZoneId": 175,
          "SubZones": [
            {
              "Id": 175,
              "Code": "Sayeda Zeinab",
              "ArName": "السيده زينب",
              "EnName": "Sayeda Zeinab"
            },
            {
              "Id": 177,
              "Code": "Sayeda Zeinab-Al Kalaa'",
              "ArName": "السيده زينب القلق",
              "EnName": "Sayeda Zeinab-Al Kalaa'"
            },
            {
              "Id": 178,
              "Code": "Sayeda Zeinab-Al Kasr Al Einy",
              "ArName": "السيده زينب القصر العيني",
              "EnName": "Sayeda Zeinab-Al Kasr Al Einy"
            },
            {
              "Id": 179,
              "Code": "Sayeda Zeinab-El Helmeya El Gedida",
              "ArName": "السيده زينب الحلميه الجديده",
              "EnName": "Sayeda Zeinab-El Helmeya El Gedida"
            },
            {
              "Id": 180,
              "Code": "Sayeda Zeinab-El Khodary",
              "ArName": "السيده زينب الخضري",
              "EnName": "Sayeda Zeinab-El Khodary"
            },
            {
              "Id": 181,
              "Code": "Sayeda Zeinab-El Nasrya",
              "ArName": "السيده زينب الناصريه",
              "EnName": "Sayeda Zeinab-El Nasrya"
            },
            {
              "Id": 182,
              "Code": "Sayeda Zeinab-Garden City",
              "ArName": "السيده زينب جاردن سيتي",
              "EnName": "Sayeda Zeinab-Garden City"
            },
            {
              "Id": 183,
              "Code": "Sayeda Zeinab-kaleat Elkabsh",
              "ArName": "السيده زينب قلعة الكبش",
              "EnName": "Sayeda Zeinab-kaleat Elkabsh"
            },
            {
              "Id": 184,
              "Code": "Sayeda Zeinab-Magles Al Shaab",
              "ArName": "السيده زينب مجلس الشعب",
              "EnName": "Sayeda Zeinab-Magles Al Shaab"
            },
            {
              "Id": 185,
              "Code": "Sayeda Zeinab-Magles Eloma",
              "ArName": "السيده زينب مجلس الامه",
              "EnName": "Sayeda Zeinab-Magles Eloma"
            }
          ]
        },
        {
          "Id": 197,
          "EnName": "Hadayek El Qobah",
          "ArName": "حدايق القبه",
          "SubZoneId": 199,
          "SubZones": [
            {
              "Id": 199,
              "Code": "Hadayek Al Qobah-Al Sheikh Al Babli",
              "ArName": "حدايق القبه الشخ البابلي",
              "EnName": "Hadayek Al Qobah-Al Sheikh Al Babli"
            },
            {
              "Id": 201,
              "Code": "Hadayek Al Qobah-El-Khalig El-Masry",
              "ArName": "حدايق القبه الخليج المصري",
              "EnName": "Hadayek Al Qobah-El-Khalig El-Masry"
            },
            {
              "Id": 202,
              "Code": "Hadayek Al Qobah-El-Shaikh Ghorab",
              "ArName": "حدايق القبه الشيخ غراب",
              "EnName": "Hadayek Al Qobah-El-Shaikh Ghorab"
            },
            {
              "Id": 204,
              "Code": "Hadayek Al Qobah-Kobry El Qobba",
              "ArName": "حدايق القبه كوبري القبه",
              "EnName": "Hadayek Al Qobah-Kobry El Qobba"
            },
            {
              "Id": 205,
              "Code": "Hadayek Al Qobah-Masr and El Swdan",
              "ArName": "حدايق القبه مصر و السودان",
              "EnName": "Hadayek Al Qobah-Masr and El Swdan"
            },
            {
              "Id": 206,
              "Code": "Hadayek Al Qobah-Saraya Al Koba",
              "ArName": "حدايق القبه سرابا القبه",
              "EnName": "Hadayek Al Qobah-Saraya Al Koba"
            },
            {
              "Id": 207,
              "Code": "Hadayek Al Qobah-Sekat Al Waili",
              "ArName": "كوبري القبه سكة الوايلي",
              "EnName": "Hadayek Al Qobah-Sekat Al Waili"
            },
            {
              "Id": 208,
              "Code": "Hadayek Al Qobah-Wali Al Ahd",
              "ArName": "كوبري القبه الوايلي",
              "EnName": "Hadayek Al Qobah-Wali Al Ahd"
            }
          ]
        },
        {
          "Id": 209,
          "EnName": "15th of May",
          "ArName": "15 مايو",
          "SubZoneId": 210,
          "SubZones": [
            {
              "Id": 210,
              "Code": "15th of May City",
              "ArName": "مدينة 15 مايو",
              "EnName": "15th of May City"
            }
          ]
        },
        {
          "Id": 211,
          "EnName": "Helwan",
          "ArName": "حلوان",
          "SubZoneId": 212,
          "SubZones": [
            {
              "Id": 212,
              "Code": "Hadayek Helwan",
              "ArName": "حدايق حلوان",
              "EnName": "Hadayek Helwan"
            },
            {
              "Id": 213,
              "Code": "Hadayek Maadi",
              "ArName": "حدايق المعادي",
              "EnName": "Hadayek Maadi"
            },
            {
              "Id": 214,
              "Code": "Helwan",
              "ArName": "حلوان",
              "EnName": "Helwan"
            },
            {
              "Id": 216,
              "Code": "Helwan-Atlas",
              "ArName": "جلوان اطلس",
              "EnName": "Helwan-Atlas"
            },
            {
              "Id": 217,
              "Code": "Helwan-El Moazafen City",
              "ArName": "حلوان مدينة الموظفين",
              "EnName": "Helwan-El Moazafen City"
            },
            {
              "Id": 218,
              "Code": "Helwan-El Shams City",
              "ArName": "حلوان مدينة الشمس",
              "EnName": "Helwan-El Shams City"
            },
            {
              "Id": 220,
              "Code": "Helwan-Helwan American project",
              "ArName": "حلوان المشروع الامريكي",
              "EnName": "Helwan-Helwan American project"
            },
            {
              "Id": 221,
              "Code": "Helwan-Rael",
              "ArName": "حلوان رايل",
              "EnName": "Helwan-Rael"
            },
            {
              "Id": 222,
              "Code": "Helwan-Wadi Houf",
              "ArName": "حلوان وادي الحوف",
              "EnName": "Helwan-Wadi Houf"
            },
            {
              "Id": 224,
              "Code": "Kozzika",
              "ArName": "كوزيكا",
              "EnName": "Kozzika"
            },
            {
              "Id": 225,
              "Code": "Tura-Elbalad",
              "ArName": "طره البلد",
              "EnName": "Tura-Elbalad"
            }
          ]
        },
        {
          "Id": 230,
          "EnName": "Eltebeen",
          "ArName": "التبيين",
          "SubZoneId": 232,
          "SubZones": [
            {
              "Id": 232,
              "Code": "Eltebeen",
              "ArName": "التبيين",
              "EnName": "Eltebeen"
            },
            {
              "Id": 233,
              "Code": "Hekr Eltebeen",
              "ArName": "حكر التبيين",
              "EnName": "Hekr Eltebeen"
            },
            {
              "Id": 234,
              "Code": "Masaken Etebeen Elshaabeya",
              "ArName": "مساكن التبيين الشعبيه",
              "EnName": "Masaken Etebeen Elshaabeya"
            },
            {
              "Id": 235,
              "Code": "Madinet Elsolb",
              "ArName": "مدينة الصلب",
              "EnName": "Madinet Elsolb"
            }
          ]
        },
        {
          "Id": 246,
          "EnName": "Maadi",
          "ArName": "المعادي",
          "SubZoneId": 261,
          "SubZones": [
            {
              "Id": 248,
              "Code": "Maadi- Taqseem Laselky",
              "ArName": "المعادي تقسيم اللاسلكي",
              "EnName": "Maadi- Taqseem Laselky"
            },
            {
              "Id": 250,
              "Code": "Maadi-Ahmed Zaki",
              "ArName": "المعادي احمد زكي",
              "EnName": "Maadi-Ahmed Zaki"
            },
            {
              "Id": 251,
              "Code": "Maadi-Becho American City",
              "ArName": "المعادي بيكو المدينه الامريكيه",
              "EnName": "Maadi-Becho American City"
            },
            {
              "Id": 252,
              "Code": "Maadi-El Gazaer Square",
              "ArName": "المعادي ميدان الجزاير ",
              "EnName": "Maadi-El Gazaer Square"
            },
            {
              "Id": 253,
              "Code": "Maadi-Hadayek El Maadi",
              "ArName": "المعادي حدايق المعادي",
              "EnName": "Maadi-Hadayek El Maadi"
            },
            {
              "Id": 254,
              "Code": "Maadi-Hassanen Desoki",
              "ArName": "المعادي حسانين دسوقي",
              "EnName": "Maadi-Hassanen Desoki"
            },
            {
              "Id": 255,
              "Code": "Maadi-Maadi Degla",
              "ArName": "المعادي دجله",
              "EnName": "Maadi-Maadi Degla"
            },
            {
              "Id": 256,
              "Code": "Maadi-Maadi Saqr Qoraish",
              "ArName": "المعادي صقر قريش",
              "EnName": "Maadi-Maadi Saqr Qoraish"
            },
            {
              "Id": 257,
              "Code": "Maadi-Mearaag Elowy",
              "ArName": "المعادي معراج العلوي",
              "EnName": "Maadi-Mearaag Elowy"
            },
            {
              "Id": 258,
              "Code": "Maadi-Meraag Sofly",
              "ArName": "المعادي معراج السفلي",
              "EnName": "Maadi-Meraag Sofly"
            },
            {
              "Id": 259,
              "Code": "Maadi-New Maadi",
              "ArName": "المعادي الجديده",
              "EnName": "Maadi-New Maadi"
            },
            {
              "Id": 260,
              "Code": "Maadi-Sakanat El Maadi",
              "ArName": "سكنات المعادي",
              "EnName": "Maadi-Sakanat El Maadi"
            },
            {
              "Id": 261,
              "Code": "Maadi-Zahraa Al Maadi",
              "ArName": "زهراء المعادي",
              "EnName": "Maadi-Zahraa Al Maadi"
            }
          ]
        },
        {
          "Id": 262,
          "EnName": "Madinaty",
          "ArName": "مدينتي",
          "SubZoneId": 263,
          "SubZones": [
            {
              "Id": 263,
              "Code": "Madinty",
              "ArName": "مدينتي",
              "EnName": "Madinty"
            }
          ]
        },
        {
          "Id": 264,
          "EnName": "Manial",
          "ArName": "المنيل",
          "SubZoneId": 266,
          "SubZones": [
            {
              "Id": 265,
              "Code": "Manial Al Rodah-Abdo Basha",
              "ArName": "منيل الروضه عبده باشا",
              "EnName": "Manial Al Rodah-Abdo Basha"
            },
            {
              "Id": 266,
              "Code": "Manial Al Rodah-El Manial",
              "ArName": "روضة المنيل",
              "EnName": "Manial Al Rodah-El Manial"
            },
            {
              "Id": 267,
              "Code": "Manial Al Rodah-El Roda",
              "ArName": "روضة الروضه",
              "EnName": "Manial Al Rodah-El Roda"
            }
          ]
        },
        {
          "Id": 269,
          "EnName": "Masr El Qadeema",
          "ArName": "مصر القديمه",
          "SubZoneId": 270,
          "SubZones": [
            {
              "Id": 270,
              "Code": "Misr El-Kadima",
              "ArName": "مصر القديمه",
              "EnName": "Misr El-Kadima"
            },
            {
              "Id": 271,
              "Code": "Misr El-Kadima-Amr Ibn El-Aas",
              "ArName": "مصر القديمه عمرو ابن العاص",
              "EnName": "Misr El-Kadima-Amr Ibn El-Aas"
            },
            {
              "Id": 272,
              "Code": "Misr El-Kadima-El-Malek El-Saleh",
              "ArName": "مصر القديمه الملك الصالح",
              "EnName": "Misr El-Kadima-El-Malek El-Saleh"
            },
            {
              "Id": 273,
              "Code": "Misr El-Kadima-Fustat",
              "ArName": "مصر القديمه الفسطاط",
              "EnName": "Misr El-Kadima-Fustat"
            }
          ]
        },
        {
          "Id": 280,
          "EnName": "New Cairo",
          "ArName": "القاهره الجديده",
          "SubZoneId": 282,
          "SubZones": [
            {
              "Id": 281,
              "Code": "New Cairo- New Cairo El-Diplomaseen",
              "ArName": "القاهره الجديده الدبلوماسيين",
              "EnName": "New Cairo- New Cairo El-Diplomaseen"
            },
            {
              "Id": 282,
              "Code": "1st Settlement",
              "ArName": "التجمع الاول",
              "EnName": "1st Settlement"
            },
            {
              "Id": 283,
              "Code": "3rd Settlement",
              "ArName": "التجمع الثالث",
              "EnName": "3rd Settlement"
            },
            {
              "Id": 284,
              "Code": "5th Settlement - North 90,st",
              "ArName": "التجمع الخامس شارع التسعين الشمالي",
              "EnName": "5th Settlement - North 90,st"
            },
            {
              "Id": 285,
              "Code": "5th Settlement - South 90,st",
              "ArName": "التجمع شارع التسعين الجنوبي",
              "EnName": "5th Settlement - South 90,st"
            },
            {
              "Id": 286,
              "Code": "5th Settlement - El Narges",
              "ArName": "التجمع الخامس النرجس",
              "EnName": "5th Settlement - El Narges"
            },
            {
              "Id": 288,
              "Code": "5th Settlement - El Lotus",
              "ArName": "التجمع الخامس اللوتس",
              "EnName": "5th Settlement - El Lotus"
            },
            {
              "Id": 289,
              "Code": "5th Settlement - El Qoronfel",
              "ArName": "التجمع الخامس القرنفل",
              "EnName": "5th Settlement - El Qoronfel"
            },
            {
              "Id": 290,
              "Code": "5th Settlement - El Shouifat",
              "ArName": "التجع الخامس الشويفات",
              "EnName": "5th Settlement - El Shouifat"
            },
            {
              "Id": 291,
              "Code": "5th Settlement - El Andalus",
              "ArName": "التجمع الخامس الشويفات",
              "EnName": "5th Settlement - El Andalus"
            },
            {
              "Id": 292,
              "Code": "5th Settlement - West Arabella",
              "ArName": "التجمع الخامس غرب ارابيلا",
              "EnName": "5th Settlement - West Arabella"
            },
            {
              "Id": 293,
              "Code": "5th Settlement - AUC",
              "ArName": "التجمع الخامس الجامعه الامريكيه",
              "EnName": "5th Settlement - AUC"
            },
            {
              "Id": 294,
              "Code": "5th Settlement - Beit El Watan",
              "ArName": "التجمع الخمس بيت الوطن",
              "EnName": "5th Settlement - Beit El Watan"
            },
            {
              "Id": 295,
              "Code": "New Cairo-Mirage City",
              "ArName": "القاهره الجديده ميراج سيتي",
              "EnName": "New Cairo-Mirage City"
            },
            {
              "Id": 296,
              "Code": "New Cairo-North investors",
              "ArName": "القاهره الجديده شمال المستثمرين",
              "EnName": "New Cairo-North investors"
            },
            {
              "Id": 297,
              "Code": "New Cairo-South investors",
              "ArName": "القاهره الجديده جنوب المستثمرين",
              "EnName": "New Cairo-South investors"
            },
            {
              "Id": 298,
              "Code": "New Cairo-South of Police Academy",
              "ArName": "القاهره الجديده جنوب اكاديمية الشرطه",
              "EnName": "New Cairo-South of Police Academy"
            }
          ]
        },
        {
          "Id": 303,
          "EnName": "El Shorouk",
          "ArName": "الشروق",
          "SubZoneId": 312,
          "SubZones": [
            {
              "Id": 304,
              "Code": "El Shorouk - 3rd district",
              "ArName": "الشروق الحي الثالث",
              "EnName": "El Shorouk - 3rd district"
            },
            {
              "Id": 305,
              "Code": "El Shorouk - 7th district",
              "ArName": "الشروق الحي السابع",
              "EnName": "El Shorouk - 7th district"
            },
            {
              "Id": 307,
              "Code": "El Shorouk - 8th district",
              "ArName": "الشروق الحي الثامن",
              "EnName": "El Shorouk - 8th district"
            },
            {
              "Id": 308,
              "Code": "El Shorouk - 9th district",
              "ArName": "الشروق الحي التاسع",
              "EnName": "El Shorouk - 9th district"
            },
            {
              "Id": 309,
              "Code": "El Shorouk- 4th district",
              "ArName": "الشروق الحي الرابع",
              "EnName": "El Shorouk- 4th district"
            },
            {
              "Id": 310,
              "Code": "El Shorouk 5th district",
              "ArName": "الشروق الحي الخامس",
              "EnName": "El Shorouk 5th district"
            },
            {
              "Id": 311,
              "Code": "El Shorouk 6th district",
              "ArName": "الشروق الحي السادس",
              "EnName": "El Shorouk 6th district"
            },
            {
              "Id": 312,
              "Code": "El Shorouk - 1st district",
              "ArName": "الشروق الحي الاول",
              "EnName": "El Shorouk - 1st district"
            },
            {
              "Id": 313,
              "Code": "El Shorouk - 2nd district",
              "ArName": "الشروق الحي الثاني",
              "EnName": "El Shorouk - 2nd district"
            },
            {
              "Id": 314,
              "Code": "El Shorouk Eskan Al Shabab",
              "ArName": "الشروق اسكان الشباب",
              "EnName": "El Shorouk Eskan Al Shabab"
            },
            {
              "Id": 315,
              "Code": "El Shorouk Family Housing",
              "ArName": "الشروق الاسكان العائلي",
              "EnName": "El Shorouk Family Housing"
            },
            {
              "Id": 316,
              "Code": "El Shorouk Future City",
              "ArName": "الشروق مدينة المستقبل",
              "EnName": "El Shorouk Future City"
            },
            {
              "Id": 317,
              "Code": "El Shrouk-Cairo Suez Desert Rd",
              "ArName": "الشروق طريق السويس الصحراوي",
              "EnName": "El Shrouk-Cairo Suez Desert Rd"
            },
            {
              "Id": 318,
              "Code": "El Shrouk-New Heliopolis City",
              "ArName": "الشروق مدينة هيليوبلس الجديده",
              "EnName": "El Shrouk-New Heliopolis City"
            }
          ]
        },
        {
          "Id": 319,
          "EnName": "Shoubra",
          "ArName": "شبرا",
          "SubZoneId": 321,
          "SubZones": [
            {
              "Id": 321,
              "Code": "Shubra-El Khalafawy",
              "ArName": "شبرا الخلفاوي",
              "EnName": "Shubra-El Khalafawy"
            },
            {
              "Id": 322,
              "Code": "Shubra-Masarra",
              "ArName": "شبرا مسره",
              "EnName": "Shubra-Masarra"
            },
            {
              "Id": 323,
              "Code": "Shubra-Rod El Farag",
              "ArName": "شبرا روض الفرج",
              "EnName": "Shubra-Rod El Farag"
            }
          ]
        },
        {
          "Id": 324,
          "EnName": "Zeitoun",
          "ArName": "الزيتون",
          "SubZoneId": 326,
          "SubZones": [
            {
              "Id": 325,
              "Code": "Al Sawah",
              "ArName": "السواح",
              "EnName": "Al Sawah"
            },
            {
              "Id": 326,
              "Code": "Al Zeitoun",
              "ArName": "الزيتون",
              "EnName": "Al Zeitoun"
            },
            {
              "Id": 327,
              "Code": "Al Zeitoun-Ibn Al Hakam",
              "ArName": "الزيتون ابن الحكم",
              "EnName": "Al Zeitoun-Ibn Al Hakam"
            },
            {
              "Id": 328,
              "Code": "Al Zeitoun-Ibn Sendar",
              "ArName": "الزيتون ابن سندر",
              "EnName": "Al Zeitoun-Ibn Sendar"
            },
            {
              "Id": 329,
              "Code": "Al Zeitoun-Salim Al Awal",
              "ArName": "الزيتون سليم الاول",
              "EnName": "Al Zeitoun-Salim Al Awal"
            },
            {
              "Id": 330,
              "Code": "Al Zeitoun-Toman Bai",
              "ArName": "الزيتون تومان باي",
              "EnName": "Al Zeitoun-Toman Bai"
            },
            {
              "Id": 331,
              "Code": "Amiria",
              "ArName": "الاميريه",
              "EnName": "Amiria"
            },
            {
              "Id": 332,
              "Code": "Helmeya",
              "ArName": "الحلميه",
              "EnName": "Helmeya"
            },
            {
              "Id": 333,
              "Code": "Helmiet Elzaitoun",
              "ArName": "حلمية الزيتون",
              "EnName": "Helmiet Elzaitoun"
            }
          ]
        },
        {
          "Id": 2123,
          "EnName": "Al Amiriyyah",
          "ArName": "الأميرية",
          "SubZoneId": 2124,
          "SubZones": [
            {
              "Id": 2124,
              "Code": "AMRY",
              "ArName": "الأميرية",
              "EnName": "Al Amiriyyah"
            }
          ]
        },
        {
          "Id": 2125,
          "EnName": "Al Abageyah",
          "ArName": "الأباجية",
          "SubZoneId": 2126,
          "SubZones": [
            {
              "Id": 2126,
              "Code": "ABAG",
              "ArName": "الأباجية",
              "EnName": "Al Abageyah"
            }
          ]
        },
        {
          "Id": 2127,
          "EnName": "Tura",
          "ArName": "طره",
          "SubZoneId": 2128,
          "SubZones": [
            {
              "Id": 2128,
              "Code": "TURA",
              "ArName": "طره",
              "EnName": "Tura"
            }
          ]
        },
        {
          "Id": 2133,
          "EnName": "El Hadba EL wosta",
          "ArName": "الهضبة الوسطى",
          "SubZoneId": 2134,
          "SubZones": [
            {
              "Id": 2134,
              "Code": "HDBA",
              "ArName": "الهضبة الوسطى",
              "EnName": "El Hadba EL wosta"
            }
          ]
        },
        {
          "Id": 2137,
          "EnName": "El Saf",
          "ArName": "الصف",
          "SubZoneId": 2138,
          "SubZones": [
            {
              "Id": 2138,
              "Code": "SAF",
              "ArName": "الصف",
              "EnName": "El Saf"
            }
          ]
        },
        {
          "Id": 2139,
          "EnName": "Ghamra",
          "ArName": "غمره",
          "SubZoneId": 2140,
          "SubZones": [
            {
              "Id": 2140,
              "Code": "GHMR",
              "ArName": "غمره",
              "EnName": "Ghamra"
            }
          ]
        },
        {
          "Id": 2141,
          "EnName": "El Zaher",
          "ArName": "الظاهر",
          "SubZoneId": 2142,
          "SubZones": [
            {
              "Id": 2142,
              "Code": "ZAHR",
              "ArName": "الظاهر",
              "EnName": "El Zaher"
            }
          ]
        },
        {
          "Id": 2143,
          "EnName": "Abbaseya",
          "ArName": "العباسية",
          "SubZoneId": 2144,
          "SubZones": [
            {
              "Id": 2144,
              "Code": "ABAS",
              "ArName": "العباسية",
              "EnName": "Abbaseya"
            }
          ]
        },
        {
          "Id": 2145,
          "EnName": "Al Sharabiya",
          "ArName": "الشرابية",
          "SubZoneId": 2146,
          "SubZones": [
            {
              "Id": 2146,
              "Code": "SHRB",
              "ArName": "الشرابية",
              "EnName": "Al Sharabiya"
            }
          ]
        },
        {
          "Id": 2147,
          "EnName": "Rod El Farag",
          "ArName": "روض الفرج",
          "SubZoneId": 2148,
          "SubZones": [
            {
              "Id": 2148,
              "Code": "FRAG",
              "ArName": "روض الفرج",
              "EnName": "Rod El Farag"
            }
          ]
        },
        {
          "Id": 2149,
          "EnName": "Al Khusus",
          "ArName": "الخصوص",
          "SubZoneId": 2150,
          "SubZones": [
            {
              "Id": 2150,
              "Code": "KHSU",
              "ArName": "الخصوص",
              "EnName": "Al Khusus"
            }
          ]
        },
        {
          "Id": 2151,
          "EnName": "El Zawya El Hamra",
          "ArName": "الزاوية الحمرا",
          "SubZoneId": 2152,
          "SubZones": [
            {
              "Id": 2152,
              "Code": "ZWYA",
              "ArName": "الزاوية الحمرا",
              "EnName": "El Zawya El Hamra"
            }
          ]
        },
        {
          "Id": 2153,
          "EnName": "Awal Shubra Al Kheimah",
          "ArName": "أول شبرا الخيمه",
          "SubZoneId": 2154,
          "SubZones": [
            {
              "Id": 2154,
              "Code": "KHM1",
              "ArName": "أول شبرا الخيمه",
              "EnName": "Awal Shubra Al Kheimah"
            }
          ]
        },
        {
          "Id": 2155,
          "EnName": "Shubra El Kheima 2",
          "ArName": "2 شبرا الخيمه",
          "SubZoneId": 2156,
          "SubZones": [
            {
              "Id": 2156,
              "Code": "KHM2",
              "ArName": "2 شبرا الخيمه",
              "EnName": "Shubra El Kheima 2"
            }
          ]
        },
        {
          "Id": 2157,
          "EnName": "Future City",
          "ArName": "مدينة المستقبل",
          "SubZoneId": 2158,
          "SubZones": [
            {
              "Id": 2158,
              "Code": "FUTR",
              "ArName": "مدينة المستقبل",
              "EnName": "Future City"
            }
          ]
        },
        {
          "Id": 2159,
          "EnName": "New Heliopolis City",
          "ArName": "مدينة هيليوبلس الجديدة",
          "SubZoneId": 2160,
          "SubZones": [
            {
              "Id": 2160,
              "Code": "NHEL",
              "ArName": "مدينة هيليوبلس الجديدة",
              "EnName": "New Heliopolis City"
            }
          ]
        },
        {
          "Id": 2161,
          "EnName": "El Obour City",
          "ArName": "مدينة العبور",
          "SubZoneId": 2162,
          "SubZones": [
            {
              "Id": 2162,
              "Code": "OBOR",
              "ArName": "مدينة العبور",
              "EnName": "El Obour City"
            }
          ]
        },
        {
          "Id": 2163,
          "EnName": "10th of Ramadan",
          "ArName": "مدينة العاشر من رمضان",
          "SubZoneId": 2164,
          "SubZones": [
            {
              "Id": 2164,
              "Code": "RMDN",
              "ArName": "مدينة العاشر من رمضان",
              "EnName": "10th of Ramadan"
            }
          ]
        },
        {
          "Id": 2199,
          "EnName": "Elsayeda Aisha",
          "ArName": "السيدة عائشه",
          "SubZoneId": 2200,
          "SubZones": [
            {
              "Id": 2200,
              "Code": "ESHA",
              "ArName": "السيدة عائشه",
              "EnName": "Elsayeda Aisha"
            }
          ]
        },
        {
          "Id": 2201,
          "EnName": "Izbat an Nakhl",
          "ArName": "عزبة النخل",
          "SubZoneId": 2202,
          "SubZones": [
            {
              "Id": 2202,
              "Code": "NKHL",
              "ArName": "عزبة النخل",
              "EnName": "Izbat an Nakhl"
            }
          ]
        },
        {
          "Id": 2203,
          "EnName": "CFC",
          "ArName": "CFC",
          "SubZoneId": 2204,
          "SubZones": [
            {
              "Id": 2204,
              "Code": "CFC",
              "ArName": "CFC",
              "EnName": "CFC"
            }
          ]
        }
      ]
    },
    {
      "Id": 3,
      "EnName": "Giza",
      "ArName": "الجيزة",
      "Zones": [
        {
          "Id": 336,
          "EnName": "Agouza",
          "ArName": "العجوزه",
          "SubZoneId": 340,
          "SubZones": [
            {
              "Id": 337,
              "Code": "Agouza-Abou El Dahab Square",
              "ArName": "العجوزه ميدان ابو الدهب",
              "EnName": "Agouza-Abou El Dahab Square"
            },
            {
              "Id": 338,
              "Code": "Agouza-Abu Al Mawahib Square",
              "ArName": "العجوزه ميدان ابو المواهب",
              "EnName": "Agouza-Abu Al Mawahib Square"
            },
            {
              "Id": 339,
              "Code": "Agouza-Aswan square",
              "ArName": "العجوزه ميدان اسوان",
              "EnName": "Agouza-Aswan square"
            },
            {
              "Id": 340,
              "Code": "Agouza-Balloon Theatre",
              "ArName": "العجوزه مسرح البالون",
              "EnName": "Agouza-Balloon Theatre"
            },
            {
              "Id": 341,
              "Code": "Agouza-Nawal Street",
              "ArName": "العجوزه شارع نوال",
              "EnName": "Agouza-Nawal Street"
            },
            {
              "Id": 342,
              "Code": "Elheiteya",
              "ArName": "الحيتيه",
              "EnName": "Elheiteya"
            },
            {
              "Id": 343,
              "Code": "Kawakby Square",
              "ArName": "ميدان الكواكبي",
              "EnName": "Kawakby Square"
            },
            {
              "Id": 344,
              "Code": "Agouza-Sphinx Square",
              "ArName": "العجوزه ميدان سفنكس",
              "EnName": "Agouza-Sphinx Square"
            }
          ]
        },
        {
          "Id": 347,
          "EnName": "Dokki",
          "ArName": "الدقي",
          "SubZoneId": 349,
          "SubZones": [
            {
              "Id": 349,
              "Code": "Dokki-26 July Axis",
              "ArName": "الدقي محور 26 يوليو",
              "EnName": "Dokki-26 July Axis"
            },
            {
              "Id": 351,
              "Code": "Dokki-Al Awqaf buildings",
              "ArName": "الدقي مباني الاوقاف",
              "EnName": "Dokki-Al Awqaf buildings"
            },
            {
              "Id": 352,
              "Code": "Dokki-Al Behos",
              "ArName": "الدقي البحوث",
              "EnName": "Dokki-Al Behos"
            },
            {
              "Id": 353,
              "Code": "Dokki-Amman Square",
              "ArName": "الدقي ميدان عمان",
              "EnName": "Dokki-Amman Square"
            },
            {
              "Id": 354,
              "Code": "Dokki-Babel Square",
              "ArName": "الدقي ميدان بابل",
              "EnName": "Dokki-Babel Square"
            },
            {
              "Id": 355,
              "Code": "Dokki-Ben ElSaryat",
              "ArName": "الدقي بين السرايات",
              "EnName": "Dokki-Ben ElSaryat"
            },
            {
              "Id": 356,
              "Code": "Dokki-El Galaa Square",
              "ArName": "الدقي ميدان الجلاء",
              "EnName": "Dokki-El Galaa Square"
            },
            {
              "Id": 357,
              "Code": "Dokki-El Messaha Square",
              "ArName": "الدقي ميدان المساحه",
              "EnName": "Dokki-El Messaha Square"
            },
            {
              "Id": 358,
              "Code": "Dokki-El Tahrir Street",
              "ArName": "الدقي شارع التحرير",
              "EnName": "Dokki-El Tahrir Street"
            },
            {
              "Id": 359,
              "Code": "Dokki-Elsayed club",
              "ArName": "الدقي نادي السيد",
              "EnName": "Dokki-Elsayed club"
            },
            {
              "Id": 360,
              "Code": "Dokki-Mohy Eldin Abou El Ezz",
              "ArName": "الدقي محي الدين ابو العز",
              "EnName": "Dokki-Mohy Eldin Abou El Ezz"
            },
            {
              "Id": 361,
              "Code": "Dokki-Soliman Gohar",
              "ArName": "الدقي سليمان الجوهري",
              "EnName": "Dokki-Soliman Gohar"
            },
            {
              "Id": 362,
              "Code": "Dokki-Tehran Squre",
              "ArName": "الدقي ميدان طهران",
              "EnName": "Dokki-Tehran Squre"
            },
            {
              "Id": 363,
              "Code": "Dokki-Wezaret El Zeraa",
              "ArName": "الدقي وزارة الزراعه",
              "EnName": "Dokki-Wezaret El Zeraa"
            }
          ]
        },
        {
          "Id": 394,
          "EnName": "Boulak Eldakrour",
          "ArName": "بولاق الدكرور",
          "SubZoneId": 398,
          "SubZones": [
            {
              "Id": 398,
              "Code": "Boulak Nahia",
              "ArName": "بولاق ناهيا",
              "EnName": "Boulak Nahia"
            },
            {
              "Id": 2024,
              "Code": "Boulak Eldakrour",
              "ArName": "بولاق الدكرور",
              "EnName": "Boulak Eldakrour"
            }
          ]
        },
        {
          "Id": 1020,
          "EnName": "Hadayek Al Ahram",
          "ArName": "حدايق الاهرام",
          "SubZoneId": 1021,
          "SubZones": [
            {
              "Id": 1021,
              "Code": "A",
              "ArName": "ا",
              "EnName": "A"
            },
            {
              "Id": 1022,
              "Code": "B",
              "ArName": "ب",
              "EnName": "B"
            },
            {
              "Id": 1023,
              "Code": "g",
              "ArName": "ج",
              "EnName": "g"
            },
            {
              "Id": 1024,
              "Code": "D",
              "ArName": "د",
              "EnName": "D"
            },
            {
              "Id": 1025,
              "Code": "H",
              "ArName": "ه",
              "EnName": "H"
            },
            {
              "Id": 1026,
              "Code": "W",
              "ArName": "و",
              "EnName": "W"
            },
            {
              "Id": 1027,
              "Code": "M",
              "ArName": "م",
              "EnName": "M"
            },
            {
              "Id": 1028,
              "Code": "Z",
              "ArName": "ز",
              "EnName": "Z"
            },
            {
              "Id": 1029,
              "Code": "H",
              "ArName": "ح",
              "EnName": "H"
            },
            {
              "Id": 1030,
              "Code": "T",
              "ArName": "ط",
              "EnName": "T"
            },
            {
              "Id": 1031,
              "Code": "L",
              "ArName": "ل",
              "EnName": "L"
            },
            {
              "Id": 1032,
              "Code": "K",
              "ArName": "ك",
              "EnName": "K"
            },
            {
              "Id": 1033,
              "Code": "N",
              "ArName": "ن",
              "EnName": "N"
            },
            {
              "Id": 1034,
              "Code": "S",
              "ArName": "س",
              "EnName": "S"
            },
            {
              "Id": 1035,
              "Code": "ص",
              "ArName": "ص",
              "EnName": "ص"
            },
            {
              "Id": 1036,
              "Code": "ع",
              "ArName": "ع",
              "EnName": "ع"
            }
          ]
        },
        {
          "Id": 1038,
          "EnName": "Haram",
          "ArName": "هرم",
          "SubZoneId": 1039,
          "SubZones": [
            {
              "Id": 1039,
              "Code": "Haram- El-Taawon",
              "ArName": "هرم التعاون",
              "EnName": "Haram- El-Taawon"
            },
            {
              "Id": 1040,
              "Code": "Haram- Nazlet El-Semman",
              "ArName": "هرم نزلة السمان",
              "EnName": "Haram- Nazlet El-Semman"
            },
            {
              "Id": 1042,
              "Code": "Haram-El-Arish Street",
              "ArName": "هرم شارع العريش",
              "EnName": "Haram-El-Arish Street"
            },
            {
              "Id": 1043,
              "Code": "Haram-Kafr El Gabal",
              "ArName": "هرم كفر الجبل",
              "EnName": "Haram-Kafr El Gabal"
            },
            {
              "Id": 1044,
              "Code": "Haram-Nazlet Al Batran",
              "ArName": "هرم كفر البتران",
              "EnName": "Haram-Nazlet Al Batran"
            },
            {
              "Id": 1045,
              "Code": "ShabraMant",
              "ArName": "شبرامنت",
              "EnName": "ShabraMant"
            },
            {
              "Id": 1046,
              "Code": "Tirsa",
              "ArName": "ترسا",
              "EnName": "Tirsa"
            },
            {
              "Id": 2020,
              "Code": "Haram",
              "ArName": "هرم",
              "EnName": "Haram"
            },
            {
              "Id": 2021,
              "Code": "Haram- Sahl Hamza",
              "ArName": "هرم سهل حمزه",
              "EnName": "Haram- Sahl Hamza"
            },
            {
              "Id": 2022,
              "Code": "Haram-El Mansouria",
              "ArName": "هرم المنصوريه",
              "EnName": "Haram-El Mansouria"
            }
          ]
        },
        {
          "Id": 1047,
          "EnName": "Imbaba",
          "ArName": "امبابه",
          "SubZoneId": 1050,
          "SubZones": [
            {
              "Id": 1048,
              "Code": "Al Manashi",
              "ArName": "المناشي",
              "EnName": "Al Manashi"
            },
            {
              "Id": 1049,
              "Code": "Berak Alkiaam",
              "ArName": "برك الخيام",
              "EnName": "Berak Alkiaam"
            },
            {
              "Id": 1050,
              "Code": "Imbaba",
              "ArName": "امبابه",
              "EnName": "Imbaba"
            },
            {
              "Id": 1051,
              "Code": "Kit Kat",
              "ArName": "كت كات",
              "EnName": "Kit Kat"
            }
          ]
        },
        {
          "Id": 1054,
          "EnName": "Mohandseen",
          "ArName": "مهندسين",
          "SubZoneId": 1055,
          "SubZones": [
            {
              "Id": 1055,
              "Code": "Mohandessin-Ahmed Oraby",
              "ArName": "المهندسين احمد عرابي",
              "EnName": "Mohandessin-Ahmed Oraby"
            },
            {
              "Id": 1056,
              "Code": "Mohandessin-Gameat El Dowal",
              "ArName": "مهندسين جامعة الدول",
              "EnName": "Mohandessin-Gameat El Dowal"
            },
            {
              "Id": 1057,
              "Code": "Mohandessin-Geziret el Arab",
              "ArName": "مهندسين جزيرة العرب",
              "EnName": "Mohandessin-Geziret el Arab"
            },
            {
              "Id": 1058,
              "Code": "Mohandessin-Lebanon Square",
              "ArName": "مهندسين ميدان لبنان",
              "EnName": "Mohandessin-Lebanon Square"
            },
            {
              "Id": 1059,
              "Code": "Mohandessin-Met Okba",
              "ArName": "مهندسين ميت عقبه",
              "EnName": "Mohandessin-Met Okba"
            },
            {
              "Id": 1060,
              "Code": "Mohandessin-Mostafa Mahmoud Square",
              "ArName": "مهندسين ميدان مصطفي محمود",
              "EnName": "Mohandessin-Mostafa Mahmoud Square"
            },
            {
              "Id": 1061,
              "Code": "Mohandessin-Shehab Street",
              "ArName": "مهندسين شارع شهاب",
              "EnName": "Mohandessin-Shehab Street"
            }
          ]
        },
        {
          "Id": 1062,
          "EnName": "Nahia",
          "ArName": "ناهيا",
          "SubZoneId": 1063,
          "SubZones": [
            {
              "Id": 1063,
              "Code": "Nahai Elbalad",
              "ArName": "ناهيا البلد",
              "EnName": "Nahai Elbalad"
            }
          ]
        },
        {
          "Id": 1064,
          "EnName": "6th of Oct",
          "ArName": "السادس من إكتوبر",
          "SubZoneId": 1065,
          "SubZones": [
            {
              "Id": 1065,
              "Code": "1st District",
              "ArName": "الحي الاول",
              "EnName": "1st District"
            },
            {
              "Id": 1066,
              "Code": "2st District",
              "ArName": "الحي الثاني",
              "EnName": "2st District"
            },
            {
              "Id": 1067,
              "Code": "3rd District",
              "ArName": "الحي الثالث",
              "EnName": "3rd District"
            },
            {
              "Id": 1068,
              "Code": "4rd District",
              "ArName": "الحي الرابع",
              "EnName": "4rd District"
            },
            {
              "Id": 1069,
              "Code": "5th District",
              "ArName": "الحي الخامس",
              "EnName": "5th District"
            },
            {
              "Id": 1070,
              "Code": "6th District",
              "ArName": "الحي السادس",
              "EnName": "6th District"
            },
            {
              "Id": 1072,
              "Code": "7th District",
              "ArName": "الحي السابع",
              "EnName": "7th District"
            },
            {
              "Id": 1073,
              "Code": "8th District",
              "ArName": "الحي الثامن",
              "EnName": "8th District"
            },
            {
              "Id": 1074,
              "Code": "9th District",
              "ArName": "الحي التاسع",
              "EnName": "9th District"
            },
            {
              "Id": 1075,
              "Code": "10th District",
              "ArName": "الحي العاشر",
              "EnName": "10th District"
            },
            {
              "Id": 1078,
              "Code": "11th District",
              "ArName": "الحي 11",
              "EnName": "11th District"
            },
            {
              "Id": 1080,
              "Code": "12th District",
              "ArName": "الحي 12",
              "EnName": "12th District"
            },
            {
              "Id": 1081,
              "Code": "1st Industrial Area",
              "ArName": "المنطقه الصناعيه الاولي",
              "EnName": "1st Industrial Area"
            },
            {
              "Id": 1082,
              "Code": "2nd Industrial Area",
              "ArName": "المنطقه الصناعيه الثانيه",
              "EnName": "2nd Industrial Area"
            },
            {
              "Id": 1083,
              "Code": "3nd Industrial Area",
              "ArName": "المنطقه الصناعيه الثالثه",
              "EnName": "3nd Industrial Area"
            },
            {
              "Id": 1084,
              "Code": "4th Industrial Area",
              "ArName": "المنطقه الصناعيه الرابعه",
              "EnName": "4th Industrial Area"
            },
            {
              "Id": 1085,
              "Code": "5th Industrial Area",
              "ArName": "المنطقه الصناعيه الخامسه",
              "EnName": "5th Industrial Area"
            },
            {
              "Id": 1086,
              "Code": "6th Industrial Area",
              "ArName": "المنطقه الصناعيه السادسه",
              "EnName": "6th Industrial Area"
            },
            {
              "Id": 1087,
              "Code": "North Touristic Area",
              "ArName": "شمال المنطقه السياحيه",
              "EnName": "North Touristic Area"
            },
            {
              "Id": 1088,
              "Code": "Elworod",
              "ArName": "الورود",
              "EnName": "Elworod"
            },
            {
              "Id": 1089,
              "Code": "Elmotamayez",
              "ArName": "المتميز",
              "EnName": "Elmotamayez"
            },
            {
              "Id": 1090,
              "Code": "Elbashayer",
              "ArName": "البشاير",
              "EnName": "Elbashayer"
            },
            {
              "Id": 1091,
              "Code": "Gharb Soumed",
              "ArName": "غرب سوميد",
              "EnName": "Gharb Soumed"
            },
            {
              "Id": 1092,
              "Code": "Hay Elashgar",
              "ArName": "حي الاشجار",
              "EnName": "Hay Elashgar"
            },
            {
              "Id": 1093,
              "Code": "Dream Land",
              "ArName": "دريم لاند",
              "EnName": "Dream Land"
            },
            {
              "Id": 1094,
              "Code": "Palm Hills",
              "ArName": "بالم هيلز",
              "EnName": "Palm Hills"
            },
            {
              "Id": 1096,
              "Code": "6th of October",
              "ArName": "السادس من اكتوبر",
              "EnName": "6th of October"
            },
            {
              "Id": 1097,
              "Code": "Abou Rawash",
              "ArName": "ابو رواش",
              "EnName": "Abou Rawash"
            },
            {
              "Id": 1099,
              "Code": "Al Wahat",
              "ArName": "الواحات",
              "EnName": "Al Wahat"
            },
            {
              "Id": 2023,
              "Code": "South Residential District",
              "ArName": "الحي الجنوبي السكني",
              "EnName": "South Residential District"
            }
          ]
        },
        {
          "Id": 1100,
          "EnName": "Sheikh Zayed",
          "ArName": "الشيخ زايد",
          "SubZoneId": 1101,
          "SubZones": [
            {
              "Id": 1101,
              "Code": "1st District",
              "ArName": "الحي الاول",
              "EnName": "1st District"
            },
            {
              "Id": 1102,
              "Code": "2nd District",
              "ArName": "الحي الثاني",
              "EnName": "2nd District"
            },
            {
              "Id": 1103,
              "Code": "3nd District",
              "ArName": "الحي الثالث",
              "EnName": "3nd District"
            },
            {
              "Id": 1104,
              "Code": "4th District",
              "ArName": "الحي الرابع",
              "EnName": "4th District"
            },
            {
              "Id": 1105,
              "Code": "5th District",
              "ArName": "الحي الخامس",
              "EnName": "5th District"
            },
            {
              "Id": 1106,
              "Code": "6th District",
              "ArName": "الحي السادس",
              "EnName": "6th District"
            },
            {
              "Id": 1108,
              "Code": "7th District",
              "ArName": "الحي السابع",
              "EnName": "7th District"
            },
            {
              "Id": 1109,
              "Code": "8th District",
              "ArName": "الحي الثامن",
              "EnName": "8th District"
            },
            {
              "Id": 1110,
              "Code": "9th District",
              "ArName": "الحي التاسع",
              "EnName": "9th District"
            },
            {
              "Id": 1112,
              "Code": "10th District",
              "ArName": "الحي العاشر",
              "EnName": "10th District"
            },
            {
              "Id": 1113,
              "Code": "11th District",
              "ArName": "الحي 11",
              "EnName": "11th District"
            },
            {
              "Id": 1114,
              "Code": "12th District",
              "ArName": "الحي ال 12",
              "EnName": "12th District"
            },
            {
              "Id": 1115,
              "Code": "13th District",
              "ArName": "الحي ال 13",
              "EnName": "13th District"
            },
            {
              "Id": 1116,
              "Code": "14th District",
              "ArName": "الحي ال 14",
              "EnName": "14th District"
            },
            {
              "Id": 1117,
              "Code": "16th District",
              "ArName": "الحي ال 16",
              "EnName": "16th District"
            },
            {
              "Id": 1118,
              "Code": "Sheikh Zayed",
              "ArName": "الشيخ زايد",
              "EnName": "Sheikh Zayed"
            }
          ]
        },
        {
          "Id": 1119,
          "EnName": "Omraneya",
          "ArName": "عمرانيه",
          "SubZoneId": 1127,
          "SubZones": [
            {
              "Id": 1120,
              "Code": "Omraneya-Al Thalathe",
              "ArName": "عمرانيه الثلاثيني",
              "EnName": "Omraneya-Al Thalathe"
            },
            {
              "Id": 1122,
              "Code": "Omraneya-El Konayyesa",
              "ArName": "عمرانيه الكنيسه",
              "EnName": "Omraneya-El Konayyesa"
            },
            {
              "Id": 1123,
              "Code": "Omraneya-El Omraneya El Gharbeya",
              "ArName": "العمرانيه الغربيه",
              "EnName": "Omraneya-El Omraneya El Gharbeya"
            },
            {
              "Id": 1125,
              "Code": "Omraneya-El Omraneya El Sharqeya",
              "ArName": "العمرانيه الشرقيه",
              "EnName": "Omraneya-El Omraneya El Sharqeya"
            },
            {
              "Id": 1126,
              "Code": "Omraneya-Elshrkia Eastern Company",
              "ArName": "عمرانيه الشركه الشرقيه ايسترن",
              "EnName": "Omraneya-Elshrkia Eastern Company"
            },
            {
              "Id": 1127,
              "Code": "Omraneya-Khatem El-Morsaleen",
              "ArName": "عمرانيه خاتم المرسلين",
              "EnName": "Omraneya-Khatem El-Morsaleen"
            },
            {
              "Id": 1128,
              "Code": "Omraneya-Tereat Elzomor",
              "ArName": "عمرانيه ترعة الزمر",
              "EnName": "Omraneya-Tereat Elzomor"
            },
            {
              "Id": 1129,
              "Code": "Omraneya-Tersa",
              "ArName": "عمرانيه ترسه",
              "EnName": "Omraneya-Tersa"
            }
          ]
        },
        {
          "Id": 1130,
          "EnName": "Saft El Laban",
          "ArName": "صفط اللبن",
          "SubZoneId": 1131,
          "SubZones": [
            {
              "Id": 395,
              "Code": "Boulak-Kafr Tuhurmis",
              "ArName": "بولاق كفر طهرمس",
              "EnName": "Boulak-Kafr Tuhurmis"
            },
            {
              "Id": 1131,
              "Code": "Giza-Saft El Laban",
              "ArName": "جيزه صفط اللبن",
              "EnName": "Giza-Saft El Laban"
            },
            {
              "Id": 2018,
              "Code": "Hanafeya",
              "ArName": "حنفيه",
              "EnName": "Hanafeya"
            },
            {
              "Id": 2019,
              "Code": "Elmasaken",
              "ArName": "المساكن",
              "EnName": "Elmasaken"
            }
          ]
        },
        {
          "Id": 1133,
          "EnName": "Warraq",
          "ArName": "وراق",
          "SubZoneId": 1134,
          "SubZones": [
            {
              "Id": 1134,
              "Code": "Warraq",
              "ArName": "وراق",
              "EnName": "Warraq"
            }
          ]
        },
        {
          "Id": 2129,
          "EnName": "El Hawamdeyya",
          "ArName": "الحوامدية",
          "SubZoneId": 2130,
          "SubZones": [
            {
              "Id": 2130,
              "Code": "HWMD",
              "ArName": "الحوامدية",
              "EnName": "El Hawamdeyya"
            }
          ]
        },
        {
          "Id": 2131,
          "EnName": "Al Badrashin",
          "ArName": "البدرشين",
          "SubZoneId": 2132,
          "SubZones": [
            {
              "Id": 2132,
              "Code": "BDRA",
              "ArName": "البدرشين",
              "EnName": "Al Badrashin"
            },
            {
              "Id": 2217,
              "Code": "DSHR",
              "ArName": "دهشور",
              "EnName": "Dahshur"
            },
            {
              "Id": 2218,
              "Code": "SQRH",
              "ArName": "سقارة",
              "EnName": "Saqqarah"
            },
            {
              "Id": 2219,
              "Code": "ABSR",
              "ArName": "أبوصير",
              "EnName": "Abusir"
            },
            {
              "Id": 2220,
              "Code": "MDSH",
              "ArName": "منشية دهشور",
              "EnName": "Monshaat Dahshour"
            },
            {
              "Id": 2221,
              "Code": "ZDSH",
              "ArName": "زاوية دهشور",
              "EnName": "Zawyet Dahshour"
            }
          ]
        },
        {
          "Id": 2135,
          "EnName": "Al Ayat",
          "ArName": "العياط",
          "SubZoneId": 2136,
          "SubZones": [
            {
              "Id": 2136,
              "Code": "AYAT",
              "ArName": "العياط",
              "EnName": "Al Ayat"
            }
          ]
        },
        {
          "Id": 2165,
          "EnName": "Ard El Lewa",
          "ArName": "أرض اللواء",
          "SubZoneId": 2166,
          "SubZones": [
            {
              "Id": 2166,
              "Code": "LWAA",
              "ArName": "أرض اللواء",
              "EnName": "Ard El Lewa"
            }
          ]
        },
        {
          "Id": 2167,
          "EnName": "Al Baragel",
          "ArName": "البراجيل",
          "SubZoneId": 2168,
          "SubZones": [
            {
              "Id": 2168,
              "Code": "BRAG",
              "ArName": "البراجيل",
              "EnName": "Al Baragel"
            }
          ]
        },
        {
          "Id": 2169,
          "EnName": "Al Moatamadeyah",
          "ArName": "المعتمدية",
          "SubZoneId": 2170,
          "SubZones": [
            {
              "Id": 2170,
              "Code": "MOTM",
              "ArName": "المعتمدية",
              "EnName": "Al Moatamadeyah"
            }
          ]
        },
        {
          "Id": 2171,
          "EnName": "Kafr Hakim",
          "ArName": "كفر حكيم",
          "SubZoneId": 2172,
          "SubZones": [
            {
              "Id": 2172,
              "Code": "KFRH",
              "ArName": "كفر حكيم",
              "EnName": "Kafr Hakim"
            }
          ]
        },
        {
          "Id": 2173,
          "EnName": "Ossim",
          "ArName": "أوسيم",
          "SubZoneId": 2174,
          "SubZones": [
            {
              "Id": 2174,
              "Code": "OSIM",
              "ArName": "أوسيم",
              "EnName": "Ossim"
            }
          ]
        },
        {
          "Id": 2175,
          "EnName": "El Giza",
          "ArName": "الجيزة",
          "SubZoneId": 2176,
          "SubZones": [
            {
              "Id": 2176,
              "Code": "GIZA",
              "ArName": "الجيزة",
              "EnName": "El Giza"
            },
            {
              "Id": 2222,
              "Code": "ZMSL",
              "ArName": "زاوية أبو مسلم",
              "EnName": "Zawya Abou Muslim"
            }
          ]
        },
        {
          "Id": 2177,
          "EnName": "Al Munib",
          "ArName": "المنيب",
          "SubZoneId": 2178,
          "SubZones": [
            {
              "Id": 2178,
              "Code": "MUNB",
              "ArName": "المنيب",
              "EnName": "Al Munib"
            }
          ]
        },
        {
          "Id": 2179,
          "EnName": "Saqiyet Mekki",
          "ArName": "ساقية مكى",
          "SubZoneId": 2180,
          "SubZones": [
            {
              "Id": 2180,
              "Code": "MEKI",
              "ArName": "ساقية مكى",
              "EnName": "Saqiyet Mekki"
            }
          ]
        },
        {
          "Id": 2181,
          "EnName": "Abu an Numros",
          "ArName": "أبو النمرس",
          "SubZoneId": 2182,
          "SubZones": [
            {
              "Id": 2182,
              "Code": "NMRS",
              "ArName": "أبو النمرس",
              "EnName": "Abu an Numros"
            }
          ]
        },
        {
          "Id": 2183,
          "EnName": "Shubra Ment",
          "ArName": "شبرا منت",
          "SubZoneId": 2184,
          "SubZones": [
            {
              "Id": 2184,
              "Code": "MANT",
              "ArName": "شبرا منت",
              "EnName": "Shubra Ment"
            }
          ]
        },
        {
          "Id": 2185,
          "EnName": "Al Manawat",
          "ArName": "المناوات",
          "SubZoneId": 2186,
          "SubZones": [
            {
              "Id": 2186,
              "Code": "MNWT",
              "ArName": "المناوات",
              "EnName": "Al Manawat"
            }
          ]
        },
        {
          "Id": 2187,
          "EnName": "Nazlet El Semman",
          "ArName": "نزلة السمان",
          "SubZoneId": 2188,
          "SubZones": [
            {
              "Id": 2188,
              "Code": "SMAN",
              "ArName": "نزلة السمان",
              "EnName": "Nazlet El Semman"
            }
          ]
        },
        {
          "Id": 2189,
          "EnName": "Nazlet Al Batran",
          "ArName": "نزلة البطران",
          "SubZoneId": 2190,
          "SubZones": [
            {
              "Id": 2190,
              "Code": "BTRN",
              "ArName": "نزلة البطران",
              "EnName": "Nazlet Al Batran"
            }
          ]
        },
        {
          "Id": 2191,
          "EnName": "El Talbia",
          "ArName": "الطالبية",
          "SubZoneId": 2192,
          "SubZones": [
            {
              "Id": 2192,
              "Code": "TLBA",
              "ArName": "الطالبية",
              "EnName": "El Talbia"
            }
          ]
        },
        {
          "Id": 2193,
          "EnName": "Kafr Tuhurmis",
          "ArName": "كفر طهرمس",
          "SubZoneId": 2194,
          "SubZones": [
            {
              "Id": 2194,
              "Code": "TRMS",
              "ArName": "كفر طهرمس",
              "EnName": "Kafr Tuhurmis"
            }
          ]
        },
        {
          "Id": 2195,
          "EnName": "Kafr Nassar",
          "ArName": "كفر نصار",
          "SubZoneId": 2196,
          "SubZones": [
            {
              "Id": 2196,
              "Code": "NASR",
              "ArName": "كفر نصار",
              "EnName": "Kafr Nassar"
            }
          ]
        },
        {
          "Id": 2197,
          "EnName": "Abou Rawash",
          "ArName": "أبو رواش",
          "SubZoneId": 2198,
          "SubZones": [
            {
              "Id": 2198,
              "Code": "RWSH",
              "ArName": "أبو رواش",
              "EnName": "Abou Rawash"
            }
          ]
        },
        {
          "Id": 2225,
          "EnName": "Abo Rawash",
          "ArName": "أبو رواش",
          "SubZoneId": 2226,
          "SubZones": [
            {
              "Id": 2226,
              "Code": "abo rawash",
              "ArName": "أبو رواش",
              "EnName": "Abo Rawash"
            }
          ]
        }
      ]
    },
    {
      "Id": 4,
      "EnName": "Alexandria",
      "ArName": "الاسكندرية",
      "Zones": [
        {
          "Id": 2025,
          "EnName": "Alexandria",
          "ArName": "الاسكندريه",
          "SubZoneId": 2026,
          "SubZones": [
            {
              "Id": 2026,
              "Code": "Alexandria",
              "ArName": "الاسكندريه",
              "EnName": "Alexandria"
            }
          ]
        }
      ]
    },
    {
      "Id": 5,
      "EnName": "Asyut",
      "ArName": "أسيوط",
      "Zones": [
        {
          "Id": 2075,
          "EnName": "Asyut",
          "ArName": "أسيوط",
          "SubZoneId": 2099,
          "SubZones": [
            {
              "Id": 2099,
              "Code": "ASYT",
              "ArName": "أسيوط",
              "EnName": "Asyut"
            }
          ]
        }
      ]
    },
    {
      "Id": 6,
      "EnName": "Aswan",
      "ArName": "أسوان",
      "Zones": [
        {
          "Id": 2076,
          "EnName": "Aswan",
          "ArName": "أسوان",
          "SubZoneId": 2100,
          "SubZones": [
            {
              "Id": 2100,
              "Code": "ASWN",
              "ArName": "أسوان",
              "EnName": "Aswan"
            }
          ]
        }
      ]
    },
    {
      "Id": 7,
      "EnName": "Beheira",
      "ArName": "البحيرة",
      "Zones": [
        {
          "Id": 2077,
          "EnName": "Beheira",
          "ArName": "البحيرة",
          "SubZoneId": 2101,
          "SubZones": [
            {
              "Id": 2101,
              "Code": "BEHR",
              "ArName": "البحيرة",
              "EnName": "Beheira"
            }
          ]
        }
      ]
    },
    {
      "Id": 8,
      "EnName": "Beni Suef",
      "ArName": "بنى سويف",
      "Zones": [
        {
          "Id": 2078,
          "EnName": "Beni Suef",
          "ArName": "بنى سويف",
          "SubZoneId": 2102,
          "SubZones": [
            {
              "Id": 2102,
              "Code": "BENS",
              "ArName": "بنى سويف",
              "EnName": "Beni Suef"
            }
          ]
        }
      ]
    },
    {
      "Id": 9,
      "EnName": "Dakahlia",
      "ArName": "الدقهلية",
      "Zones": [
        {
          "Id": 2079,
          "EnName": "Dakahlia",
          "ArName": "الدقهلية",
          "SubZoneId": 2103,
          "SubZones": [
            {
              "Id": 2103,
              "Code": "DAKH",
              "ArName": "الدقهلية",
              "EnName": "Dakahlia"
            }
          ]
        }
      ]
    },
    {
      "Id": 10,
      "EnName": "Damietta",
      "ArName": "دمياط",
      "Zones": [
        {
          "Id": 2080,
          "EnName": "Damietta",
          "ArName": "دمياط",
          "SubZoneId": 2104,
          "SubZones": [
            {
              "Id": 2104,
              "Code": "DAMT",
              "ArName": "دمياط",
              "EnName": "Damietta"
            }
          ]
        }
      ]
    },
    {
      "Id": 11,
      "EnName": "Faiyum",
      "ArName": "الفيوم",
      "Zones": [
        {
          "Id": 2081,
          "EnName": "Faiyum",
          "ArName": "الفيوم",
          "SubZoneId": 2105,
          "SubZones": [
            {
              "Id": 2105,
              "Code": "FAYM",
              "ArName": "الفيوم",
              "EnName": "Faiyum"
            }
          ]
        },
        {
          "Id": 2258,
          "EnName": "Atssa",
          "ArName": "اطسا",
          "SubZoneId": 2259,
          "SubZones": [
            {
              "Id": 2259,
              "Code": "Atssa",
              "ArName": "اطسا",
              "EnName": "Atssa"
            }
          ]
        },
        {
          "Id": 2260,
          "EnName": "Abshway",
          "ArName": "ابشواى",
          "SubZoneId": 2261,
          "SubZones": [
            {
              "Id": 2261,
              "Code": "Abshway",
              "ArName": "ابشواى",
              "EnName": "Abshway"
            }
          ]
        },
        {
          "Id": 2262,
          "EnName": "Youssef Elseddik",
          "ArName": "يوسف الصديق",
          "SubZoneId": 2263,
          "SubZones": [
            {
              "Id": 2263,
              "Code": "Youssef Elseddik",
              "ArName": "يوسف الصديق",
              "EnName": "Youssef Elseddik"
            }
          ]
        },
        {
          "Id": 2264,
          "EnName": "Senoras",
          "ArName": "سنورس",
          "SubZoneId": 2265,
          "SubZones": [
            {
              "Id": 2265,
              "Code": "Senoras",
              "ArName": "سنورس",
              "EnName": "Senoras"
            }
          ]
        },
        {
          "Id": 2266,
          "EnName": "Tamya",
          "ArName": "طما",
          "SubZoneId": 2267,
          "SubZones": [
            {
              "Id": 2267,
              "Code": "Tamya",
              "ArName": "طما",
              "EnName": "Tamya"
            }
          ]
        }
      ]
    },
    {
      "Id": 12,
      "EnName": "Gharbia",
      "ArName": "الغربية",
      "Zones": [
        {
          "Id": 2082,
          "EnName": "Gharbia",
          "ArName": "الغربية",
          "SubZoneId": 2106,
          "SubZones": [
            {
              "Id": 2106,
              "Code": "GHRB",
              "ArName": "الغربية",
              "EnName": "Gharbia"
            }
          ]
        }
      ]
    },
    {
      "Id": 13,
      "EnName": "Ismailia",
      "ArName": "الإسماعيلية",
      "Zones": [
        {
          "Id": 2083,
          "EnName": "Ismailia",
          "ArName": "الإسماعيلية",
          "SubZoneId": 2107,
          "SubZones": [
            {
              "Id": 2107,
              "Code": "ISML",
              "ArName": "الإسماعيلية",
              "EnName": "Ismailia"
            }
          ]
        }
      ]
    },
    {
      "Id": 14,
      "EnName": "Kafr El Sheikh",
      "ArName": "كفر الشيخ",
      "Zones": [
        {
          "Id": 2084,
          "EnName": "Kafr El Sheikh",
          "ArName": "كفر الشيخ",
          "SubZoneId": 2108,
          "SubZones": [
            {
              "Id": 2108,
              "Code": "SHKH",
              "ArName": "كفر الشيخ",
              "EnName": "Kafr El Sheikh"
            }
          ]
        }
      ]
    },
    {
      "Id": 15,
      "EnName": "Luxor",
      "ArName": "الأقصر",
      "Zones": [
        {
          "Id": 2085,
          "EnName": "Luxor",
          "ArName": "الأقصر",
          "SubZoneId": 2109,
          "SubZones": [
            {
              "Id": 2109,
              "Code": "LUXR",
              "ArName": "الأقصر",
              "EnName": "Luxor"
            }
          ]
        }
      ]
    },
    {
      "Id": 16,
      "EnName": "Matruh",
      "ArName": "مرسى مطروح",
      "Zones": [
        {
          "Id": 2086,
          "EnName": "Matruh",
          "ArName": "مرسى مطروح",
          "SubZoneId": 2110,
          "SubZones": [
            {
              "Id": 2110,
              "Code": "MTRH",
              "ArName": "مرسى مطروح",
              "EnName": "Matruh"
            }
          ]
        }
      ]
    },
    {
      "Id": 17,
      "EnName": "Minya",
      "ArName": "المنيا",
      "Zones": [
        {
          "Id": 2087,
          "EnName": "Minya",
          "ArName": "المنيا",
          "SubZoneId": 2111,
          "SubZones": [
            {
              "Id": 2111,
              "Code": "MNYA",
              "ArName": "المنيا",
              "EnName": "Minya"
            }
          ]
        }
      ]
    },
    {
      "Id": 18,
      "EnName": "Monufia",
      "ArName": "المنوفية",
      "Zones": [
        {
          "Id": 2088,
          "EnName": "Monufia",
          "ArName": "المنوفية",
          "SubZoneId": 2112,
          "SubZones": [
            {
              "Id": 2112,
              "Code": "MONF",
              "ArName": "المنوفية",
              "EnName": "Monufia"
            }
          ]
        }
      ]
    },
    {
      "Id": 19,
      "EnName": "El Wadi el Gedid",
      "ArName": "الوادى الجديد",
      "Zones": [
        {
          "Id": 2089,
          "EnName": "El Wadi el Gedid",
          "ArName": "الوادى الجديد",
          "SubZoneId": 2113,
          "SubZones": [
            {
              "Id": 2113,
              "Code": "WADI",
              "ArName": "الوادى الجديد",
              "EnName": "El Wadi el Gedid"
            }
          ]
        }
      ]
    },
    {
      "Id": 20,
      "EnName": "North Sinai",
      "ArName": "شمال سيناء",
      "Zones": [
        {
          "Id": 2090,
          "EnName": "North Sinai",
          "ArName": "شمال سيناء",
          "SubZoneId": 2114,
          "SubZones": [
            {
              "Id": 2114,
              "Code": "NSNA",
              "ArName": "شمال سيناء",
              "EnName": "North Sinai"
            }
          ]
        }
      ]
    },
    {
      "Id": 21,
      "EnName": "Port Said",
      "ArName": "بورسعيد",
      "Zones": [
        {
          "Id": 2091,
          "EnName": "Port Said",
          "ArName": "بورسعيد",
          "SubZoneId": 2115,
          "SubZones": [
            {
              "Id": 2115,
              "Code": "PORS",
              "ArName": "بورسعيد",
              "EnName": "Port Said"
            }
          ]
        }
      ]
    },
    {
      "Id": 22,
      "EnName": "Qalyubia",
      "ArName": "القليوبية",
      "Zones": [
        {
          "Id": 2092,
          "EnName": "Qalyubia",
          "ArName": "القليوبية",
          "SubZoneId": 2116,
          "SubZones": [
            {
              "Id": 2116,
              "Code": "QLYB",
              "ArName": "القليوبية",
              "EnName": "Qalyubia"
            }
          ]
        }
      ]
    },
    {
      "Id": 23,
      "EnName": "Qena",
      "ArName": "قنا",
      "Zones": [
        {
          "Id": 2093,
          "EnName": "Qena",
          "ArName": "قنا",
          "SubZoneId": 2117,
          "SubZones": [
            {
              "Id": 2117,
              "Code": "QENA",
              "ArName": "قنا",
              "EnName": "Qena"
            }
          ]
        }
      ]
    },
    {
      "Id": 24,
      "EnName": "Red Sea",
      "ArName": "البحر الأحمر",
      "Zones": [
        {
          "Id": 2094,
          "EnName": "Red Sea",
          "ArName": "البحر الأحمر",
          "SubZoneId": 2118,
          "SubZones": [
            {
              "Id": 2118,
              "Code": "REDS",
              "ArName": "البحر الأحمر",
              "EnName": "Red Sea"
            }
          ]
        },
        {
          "Id": 2207,
          "EnName": "Hurghada",
          "ArName": "Hurghada",
          "SubZoneId": 2212,
          "SubZones": [
            {
              "Id": 2212,
              "Code": "Hurghada",
              "ArName": "Hurghada",
              "EnName": "Hurghada"
            }
          ]
        },
        {
          "Id": 2208,
          "EnName": "Marsa Alam",
          "ArName": "Marsa Alam",
          "SubZoneId": 2213,
          "SubZones": [
            {
              "Id": 2213,
              "Code": "MarsaAlam",
              "ArName": "Marsa Alam",
              "EnName": "Marsa Alam"
            }
          ]
        },
        {
          "Id": 2209,
          "EnName": "Ras Ghareb",
          "ArName": "Ras Ghareb",
          "SubZoneId": 2214,
          "SubZones": [
            {
              "Id": 2214,
              "Code": "RasGhareb",
              "ArName": "Ras Ghareb",
              "EnName": "Ras Ghareb"
            }
          ]
        },
        {
          "Id": 2210,
          "EnName": "El Qoseir",
          "ArName": "El Qoseir",
          "SubZoneId": 2215,
          "SubZones": [
            {
              "Id": 2215,
              "Code": "ElQoseir",
              "ArName": "El Qoseir",
              "EnName": "El Qoseir"
            }
          ]
        },
        {
          "Id": 2211,
          "EnName": "Safaga",
          "ArName": "Safaga",
          "SubZoneId": 2216,
          "SubZones": [
            {
              "Id": 2216,
              "Code": "Safaga",
              "ArName": "Safaga",
              "EnName": "Safaga"
            }
          ]
        }
      ]
    },
    {
      "Id": 25,
      "EnName": "Sharqia",
      "ArName": "الشرقية",
      "Zones": [
        {
          "Id": 2095,
          "EnName": "Sharqia",
          "ArName": "الشرقية",
          "SubZoneId": 2119,
          "SubZones": [
            {
              "Id": 2119,
              "Code": "SHRK",
              "ArName": "الشرقية",
              "EnName": "Sharqia"
            }
          ]
        }
      ]
    },
    {
      "Id": 26,
      "EnName": "Sohag",
      "ArName": "سوهاج",
      "Zones": [
        {
          "Id": 2096,
          "EnName": "Sohag",
          "ArName": "سوهاج",
          "SubZoneId": 2120,
          "SubZones": [
            {
              "Id": 2120,
              "Code": "SOHG",
              "ArName": "سوهاج",
              "EnName": "Sohag"
            }
          ]
        }
      ]
    },
    {
      "Id": 27,
      "EnName": "South Sinai",
      "ArName": "جنوب سيناء",
      "Zones": [
        {
          "Id": 2097,
          "EnName": "South Sinai",
          "ArName": "جنوب سيناء",
          "SubZoneId": 2121,
          "SubZones": [
            {
              "Id": 2121,
              "Code": "SSINA",
              "ArName": "جنوب سيناء",
              "EnName": "South Sinai"
            }
          ]
        }
      ]
    },
    {
      "Id": 28,
      "EnName": "Suez",
      "ArName": "السويس",
      "Zones": [
        {
          "Id": 2098,
          "EnName": "Suez",
          "ArName": "السويس",
          "SubZoneId": 2122,
          "SubZones": [
            {
              "Id": 2122,
              "Code": "SUEZ",
              "ArName": "السويس",
              "EnName": "Suez"
            }
          ]
        }
      ]
    },
    {
      "Id": 29,
      "EnName": "North Coast",
      "ArName": "الساحل الشمالي",
      "Zones": [
        {
          "Id": 2205,
          "EnName": "North Coast",
          "ArName": "الساحل الشمالي",
          "SubZoneId": 2206,
          "SubZones": [
            {
              "Id": 2206,
              "Code": "NorthCoast",
              "ArName": "الساحل الشمالي",
              "EnName": "North Coast"
            }
          ]
        }
      ]
    },
    {
      "Id": 30,
      "EnName": "International",
      "ArName": "دولى",
      "Zones": [
        {
          "Id": 2223,
          "EnName": "International",
          "ArName": "دولى",
          "SubZoneId": 2224,
          "SubZones": [
            {
              "Id": 2224,
              "Code": "INT",
              "ArName": "دولى",
              "EnName": "International"
            }
          ]
        }
      ]
    },
    {
      "Id": 31,
      "EnName": "Banha City",
      "ArName": "بنها",
      "Zones": [
        {
          "Id": 2227,
          "EnName": "Abozaabal",
          "ArName": "ابو زعبل",
          "SubZoneId": 2228,
          "SubZones": [
            {
              "Id": 2228,
              "Code": "AbozaabaL",
              "ArName": "ابو زعبل",
              "EnName": "Abozaabal"
            },
            {
              "Id": 2236,
              "Code": "El Gabal Elasfar",
              "ArName": "الجبل الاصفر",
              "EnName": "El Gabal Elasfar"
            }
          ]
        },
        {
          "Id": 2229,
          "EnName": "Elkhanka",
          "ArName": "الخانكه",
          "SubZoneId": 2237,
          "SubZones": [
            {
              "Id": 2237,
              "Code": "Khanka",
              "ArName": "الخانكه",
              "EnName": "Khanka"
            },
            {
              "Id": 2238,
              "Code": "Kharkania",
              "ArName": "الخرقانية",
              "EnName": "Kharkania"
            },
            {
              "Id": 2239,
              "Code": "Khosous",
              "ArName": "الخصوص",
              "EnName": "Khosous"
            },
            {
              "Id": 2240,
              "Code": "El Alag",
              "ArName": "القلج",
              "EnName": "El Alag"
            }
          ]
        },
        {
          "Id": 2230,
          "EnName": "Qanater",
          "ArName": "القناطر",
          "SubZoneId": 2241,
          "SubZones": [
            {
              "Id": 2241,
              "Code": "Qanater Khairya",
              "ArName": "القناطر الخيريه",
              "EnName": "Qanater Khairya"
            },
            {
              "Id": 2242,
              "Code": "Basous",
              "ArName": "باسوس",
              "EnName": "Basous"
            },
            {
              "Id": 2243,
              "Code": "Abu Elghet",
              "ArName": "ابو الغيط",
              "EnName": "Abu Elghet"
            },
            {
              "Id": 2244,
              "Code": "El baradaa",
              "ArName": "البرادعة",
              "EnName": "El baradaa"
            },
            {
              "Id": 2245,
              "Code": "Belkas",
              "ArName": "بلقاس",
              "EnName": "Belkas"
            }
          ]
        },
        {
          "Id": 2231,
          "EnName": "Banha",
          "ArName": "بنها",
          "SubZoneId": 2246,
          "SubZones": [
            {
              "Id": 2246,
              "Code": "Banha",
              "ArName": "بنها",
              "EnName": "Banha"
            },
            {
              "Id": 2247,
              "Code": "Kafr Shokr",
              "ArName": "كفر شكر",
              "EnName": "Kafr Shokr"
            }
          ]
        },
        {
          "Id": 2232,
          "EnName": "Shebin elqanater",
          "ArName": "شبين القناطر",
          "SubZoneId": 2249,
          "SubZones": [
            {
              "Id": 2248,
              "Code": "Seiaqous",
              "ArName": "سرياقوس",
              "EnName": "Seiaqous"
            },
            {
              "Id": 2249,
              "Code": "Sheiben El Qanater",
              "ArName": "شبين القناطر",
              "EnName": "Sheiben El Qanater"
            },
            {
              "Id": 2250,
              "Code": "El Gaafra",
              "ArName": "الجعافرة",
              "EnName": "El Gaafra"
            },
            {
              "Id": 2251,
              "Code": "Shalakan",
              "ArName": "شلقان",
              "EnName": "Shalakan"
            }
          ]
        },
        {
          "Id": 2233,
          "EnName": "Toukh",
          "ArName": "طوخ",
          "SubZoneId": 2252,
          "SubZones": [
            {
              "Id": 2252,
              "Code": "Toukh",
              "ArName": "طوخ",
              "EnName": "Toukh"
            }
          ]
        },
        {
          "Id": 2234,
          "EnName": "Qalyoub",
          "ArName": "قليوب",
          "SubZoneId": 2256,
          "SubZones": [
            {
              "Id": 2253,
              "Code": "Qalma",
              "ArName": "قلما",
              "EnName": "Qalma"
            },
            {
              "Id": 2254,
              "Code": "Kom Eshfeen",
              "ArName": "كوم اشفين",
              "EnName": "Kom Eshfeen"
            },
            {
              "Id": 2255,
              "Code": "Tanan",
              "ArName": "طنان",
              "EnName": "Tanan"
            },
            {
              "Id": 2256,
              "Code": "Qalyoub",
              "ArName": "قليوب",
              "EnName": "Qalyoub"
            }
          ]
        },
        {
          "Id": 2235,
          "EnName": "Qaha",
          "ArName": "قها",
          "SubZoneId": 2257,
          "SubZones": [
            {
              "Id": 2257,
              "Code": "Qaha",
              "ArName": "قها",
              "EnName": "Qaha"
            }
          ]
        }
      ]
    },
    {
      "Id": 32,
      "EnName": "SEWA",
      "ArName": "سيوة",
      "Zones": [
        {
          "Id": 2268,
          "EnName": "SEWA",
          "ArName": "سيوة",
          "SubZoneId": 2269,
          "SubZones": [
            {
              "Id": 2269,
              "Code": "SEWA",
              "ArName": "سيوة",
              "EnName": "SEWA"
            }
          ]
        }
      ]
    },
    {
      "Id": 33,
      "EnName": "El-Rehab",
      "ArName": "الرحاب",
      "Zones": [
        {
          "Id": 2270,
          "EnName": "El-Rehab",
          "ArName": "الرحاب",
          "SubZoneId": 2271,
          "SubZones": [
            {
              "Id": 2271,
              "Code": "El-Rehab",
              "ArName": "الرحاب",
              "EnName": "El-Rehab"
            }
          ]
        }
      ]
    }
  ]
}; 