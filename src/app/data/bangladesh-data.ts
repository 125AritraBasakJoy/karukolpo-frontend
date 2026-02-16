export interface District {
    name: string;
    subDistricts: string[];
}

export const districts: District[] = [
    {
        name: "Bagerhat",
        subDistricts: ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"]
    },
    {
        name: "Bandarban",
        subDistricts: ["Ali Kadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"]
    },
    {
        name: "Barguna",
        subDistricts: ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"]
    },
    {
        name: "Barishal",
        subDistricts: ["Agailjhara", "Airport Thana", "Babuganj", "Bakerganj", "Banaripara", "Bandar Thana", "Barishal Sadar", "Gournadi", "Hizla", "Kawnia Thana", "Kotwali Thana", "Mehendiganj", "Muladi", "Wazirpur"]
    },
    {
        name: "Bhola",
        subDistricts: ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"]
    },
    {
        name: "Bogura",
        subDistricts: ["Adamdighi", "Bogura Sadar", "Dhunat", "Dhupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatala"]
    },
    {
        name: "Brahmanbaria",
        subDistricts: ["Akhaura", "Ashuganj", "Bancharampur", "Bijoynagar", "Brahmanbaria Sadar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail"]
    },
    {
        name: "Chandpur",
        subDistricts: ["Chandpur Sadar", "Faridganj", "Haimchar", "Haziganj", "Kachua", "Matlab Dakshin", "Matlab Uttar", "Shahrasti"]
    },
    {
        name: "Chapainawabganj",
        subDistricts: ["Bholahat", "Chapainawabganj Sadar", "Gomastapur", "Nachole", "Shibganj"]
    },
    {
        name: "Chattogram",
        subDistricts: ["Akbar Shah", "Anwara", "Bakolia", "Bandar", "Banshkhali", "Bayazid Bostami", "Boalkhali", "Chandanaish", "Chandgaon", "Chawkbazar", "Chittagong Kotwali", "Double Mooring", "EPZ", "Fatikchhari", "Halishahar", "Hathazari", "Karnaphuli", "Khulshi", "Lohagara", "Mirsharai", "Pahartali", "Panchlaish", "Patenga", "Patiya", "Rangunia", "Raozan", "Sadarghat", "Sandwip", "Satkania", "Sitakunda"]
    },
    {
        name: "Chuadanga",
        subDistricts: ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"]
    },
    {
        name: "Cox's Bazar",
        subDistricts: ["Chakaria", "Cox's Bazar Sadar", "Eidgaon", "Kutubdia", "Maheshkhali", "Pekua", "Ramu", "Teknaf", "Ukhia"]
    },
    {
        name: "Cumilla",
        subDistricts: ["Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Cumilla Sadar", "Cumilla Sadar Dakshin", "Daudkandi", "Debidwar", "Homna", "Laksam", "Lalmai", "Manoharganj", "Meghna", "Muradnagar", "Nangalkot", "Titas"]
    },
    {
        name: "Dhaka",
        subDistricts: ["Adabor", "Airport (Bimanbondor)", "Badda", "Banani", "Bangsal", "Bhashantek", "Cantonment", "Chawkbazar", "Dakshinkhan", "Darus Salam", "Demra", "Dhamrai", "Dhanmondi", "Dohar", "Gendaria", "Gulshan", "Hatirjheel", "Hazaribagh", "Jatrabari", "Kadamtali", "Kafrul", "Kalabagan", "Kamrangirchar", "Keraniganj", "Khilgaon", "Khilkhet", "Kotwali", "Lalbagh", "Mirpur", "Mohammadpur", "Motijheel", "Mugda", "Nawabganj", "New Market", "Pallabi", "Paltan", "Ramna", "Rampura", "Rupnagar", "Sabujbagh", "Savar", "Shah Ali", "Shahbagh", "Shahjahanpur", "Sher-e-Bangla Nagar", "Shyampur", "Sutrapur", "Tejgaon", "Tejgaon Industrial Area", "Turag", "Uttara", "Uttara West", "Uttarkhan", "Vasantek", "Vatara", "Wari"]
    },
    {
        name: "Dinajpur",
        subDistricts: ["Birampur", "Birganj", "Biral", "Bochaganj", "Chirirbandar", "Dinajpur Sadar", "Fulbari", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur"]
    },
    {
        name: "Faridpur",
        subDistricts: ["Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"]
    },
    {
        name: "Feni",
        subDistricts: ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"]
    },
    {
        name: "Gaibandha",
        subDistricts: ["Fulchhari", "Gaibandha Sadar", "Gobindaganj", "Palashbari", "Sadullapur", "Saghata", "Sundarganj"]
    },
    {
        name: "Gazipur",
        subDistricts: ["Bason Thana", "Gacha Thana", "Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Kashimpur Thana", "Konabari Thana", "Pubail Thana", "Sreepur", "Tongi East", "Tongi West"]
    },
    {
        name: "Gopalganj",
        subDistricts: ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"]
    },
    {
        name: "Habiganj",
        subDistricts: ["Ajmiriganj", "Bahubal", "Baniyachong", "Chunarughat", "Habiganj Sadar", "Lakhai", "Madhabpur", "Nabiganj", "Shaistaganj"]
    },
    {
        name: "Jamalpur",
        subDistricts: ["Baksiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj", "Melandaha", "Sarishabari"]
    },
    {
        name: "Jashore",
        subDistricts: ["Abhaynagar", "Bagherpara", "Chaugachha", "Jashore Sadar", "Jhikargachha", "Keshabpur", "Manirampur", "Sharsha"]
    },
    {
        name: "Jhalokathi",
        subDistricts: ["Jhalokathi Sadar", "Kathalia", "Nalchity", "Rajapur"]
    },
    {
        name: "Jhenaidah",
        subDistricts: ["Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"]
    },
    {
        name: "Joypurhat",
        subDistricts: ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"]
    },
    {
        name: "Khagrachhari",
        subDistricts: ["Dighinala", "Guimara", "Khagrachhari Sadar", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"]
    },
    {
        name: "Khulna",
        subDistricts: ["Aranghata", "Batiaghata", "Dacope", "Daulatpur", "Dighalia", "Dumuria", "Harintana", "Khalishpur", "Khan Jahan Ali", "Khulna Sadar", "Koyra", "Labanchara", "Paikgachha", "Phultala", "Rupsha", "Sonadanga", "Terokhada"]
    },
    {
        name: "Kishoreganj",
        subDistricts: ["Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamoin", "Nikli", "Pakundia", "Tarail"]
    },
    {
        name: "Kurigram",
        subDistricts: ["Bhurungamari", "Char Rajibpur", "Chilmari", "Kurigram Sadar", "Nageshwari", "Phulbari", "Rajarhat", "Raomari", "Ulipur"]
    },
    {
        name: "Kushtia",
        subDistricts: ["Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur"]
    },
    {
        name: "Lakshmipur",
        subDistricts: ["Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"]
    },
    {
        name: "Lalmonirhat",
        subDistricts: ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"]
    },
    {
        name: "Madaripur",
        subDistricts: ["Dasar", "Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"]
    },
    {
        name: "Magura",
        subDistricts: ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"]
    },
    {
        name: "Manikganj",
        subDistricts: ["Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia", "Shivalaya", "Singair"]
    },
    {
        name: "Meherpur",
        subDistricts: ["Gangni", "Meherpur Sadar", "Mujibnagar"]
    },
    {
        name: "Moulvibazar",
        subDistricts: ["Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar", "Rajnagar", "Sreemangal"]
    },
    {
        name: "Munshiganj",
        subDistricts: ["Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar", "Tongibari"]
    },
    {
        name: "Mymensingh",
        subDistricts: ["Bhaluka", "Dhobaura", "Fulbaria", "Gafargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Kotwali Thana", "Muktagachha", "Mymensingh Sadar", "Nandail", "Phulpur", "Taraikanda", "Trishal"]
    },
    {
        name: "Naogaon",
        subDistricts: ["Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur", "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"]
    },
    {
        name: "Narail",
        subDistricts: ["Kalia", "Lohagara", "Narail Sadar"]
    },
    {
        name: "Narayanganj",
        subDistricts: ["Araihazar", "Bandar", "Fatullah", "Narayanganj Sadar", "Rupganj", "Siddhirganj", "Sonargaon"]
    },
    {
        name: "Narsingdi",
        subDistricts: ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"]
    },
    {
        name: "Natore",
        subDistricts: ["Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Naldanga", "Natore Sadar", "Singra"]
    },
    {
        name: "Netrokona",
        subDistricts: ["Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Kendua", "Khaliajuri", "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala"]
    },
    {
        name: "Nilphamari",
        subDistricts: ["Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur"]
    },
    {
        name: "Noakhali",
        subDistricts: ["Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat", "Noakhali Sadar", "Senbagh", "Sonaimuri", "Subarnachar"]
    },
    {
        name: "Pabna",
        subDistricts: ["Ataikula", "Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Pabna Sadar", "Santhia", "Sujanagar"]
    },
    {
        name: "Panchagarh",
        subDistricts: ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"]
    },
    {
        name: "Patuakhali",
        subDistricts: ["Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Mirzaganj", "Patuakhali Sadar", "Rangabali"]
    },
    {
        name: "Pirojpur",
        subDistricts: ["Bhandaria", "Indurkani", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Pirojpur Sadar"]
    },
    {
        name: "Rajbari",
        subDistricts: ["Baliakandi", "Goalandaghat", "Kalukhali", "Pangsha", "Rajbari Sadar"]
    },
    {
        name: "Rajshahi",
        subDistricts: ["Bagha", "Bagmara", "Boalia", "Charghat", "Durgapur", "Godagari", "Matihar", "Mohanpur", "Paba", "Puthia", "Rajpara", "Shah Mokdum", "Tanore"]
    },
    {
        name: "Rangamati",
        subDistricts: ["Bagaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai", "Kawkhali", "Langadu", "Naniarchar", "Rajasthali", "Rangamati Sadar"]
    },
    {
        name: "Rangpur",
        subDistricts: ["Badarganj", "Gangachhara", "Haragach Thana", "Hazirhat Thana", "Kaunia", "Kotwali Thana", "Mahiganj Thana", "Mithapukur", "Parshuram Thana", "Pirgachha", "Pirganj", "Rangpur Sadar", "Tajhat Thana", "Taraganj"]
    },
    {
        name: "Satkhira",
        subDistricts: ["Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar", "Shyamnagar", "Tala"]
    },
    {
        name: "Shariatpur",
        subDistricts: ["Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zajira"]
    },
    {
        name: "Sherpur",
        subDistricts: ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"]
    },
    {
        name: "Sirajganj",
        subDistricts: ["Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj", "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullahpara"]
    },
    {
        name: "Sunamganj",
        subDistricts: ["Bishwamvarpur", "Chhatak", "Derai", "Dharamapasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Madhyanagar", "Shantiganj", "Sullah", "Sunamganj Sadar", "Tahirpur"]
    },
    {
        name: "Sylhet",
        subDistricts: ["Balaganj", "Beanibazar", "Bimanbandar Thana", "Bishwanath", "Companiganj", "Dakshin Surma", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Jalalabad Thana", "Kanaighat", "Moglabazar Thana", "Osmani Nagar", "Shah Poran Thana", "Sylhet Sadar", "Zakiganj"]
    },
    {
        name: "Tangail",
        subDistricts: ["Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar"]
    },
    {
        name: "Thakurgaon",
        subDistricts: ["Baliadangi", "Haripur", "Pirganj", "Ranisankail", "Thakurgaon Sadar"]
    }
];
