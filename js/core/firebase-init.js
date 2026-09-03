const firebaseConfig = { apiKey: "AIzaSyBBaUJcBSoBlCWDMH2yMIC3QLbKaPRE4Eo", authDomain: "curso-3a-widmer.firebaseapp.com", databaseURL: "https://curso-3a-widmer-default-rtdb.firebaseio.com", projectId: "curso-3a-widmer", storageBucket: "curso-3a-widmer.firebasestorage.app", messagingSenderId: "368400261904", appId: "1:368400261904:web:e62676e250786add69bb95" };
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
