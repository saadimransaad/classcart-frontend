new Vue({
  el: '#app',
  data: {
    lessons: [],
    cart: [],
    sortBy: 'subject',
    ascending: true,
    showCart: false,
    name: '',
    phone: '',
    errorMsg: '',
    successMsg: ''
  },
  computed: {
    sortedLessons() {
      return this.lessons.slice().sort((a, b) => {
        let x = a[this.sortBy];
        let y = b[this.sortBy];
        if (typeof x === 'string') {
          x = x.toLowerCase();
          y = y.toLowerCase();
        }
        return this.ascending ? (x > y ? 1 : -1) : (x < y ? 1 : -1);
      });
    },
    cartTotal() {
      return this.cart.reduce((sum, item) => sum + item.price, 0);
    }
  },
  methods: {
    loadLessons() {
      // Fetch lessons from the backend (MongoDB via Express)
      fetch('/lessons')
        .then(res => res.json())
        .then(data => {
          this.lessons = data.map((lesson, idx) => ({
            // prefer Mongo _id, fall back to existing id or index
            id: (lesson._id && lesson._id.toString()) || lesson.id || idx,
            subject: lesson.subject || lesson.topic || lesson.name,
            location: lesson.location,
            price: Number(lesson.price),
            spaces: Number(lesson.spaces ?? lesson.space ?? lesson.availability ?? 0),
            image: lesson.image || 'placeholder.jpg'
          }));
        })
        .catch(() => {
          // Fallback seed data if fetch fails (keeps UI usable)
          this.lessons = [
            { id: 1, subject: "Math", location: "London", price: 100, spaces: 5, image: "math.jpg" },
            { id: 2, subject: "English", location: "Oxford", price: 90, spaces: 5, image: "english.jpg" },
            { id: 3, subject: "Science", location: "Bristol", price: 95, spaces: 5, image: "science.jpg" },
            { id: 4, subject: "Music", location: "Leeds", price: 80, spaces: 5, image: "music.jpg" },
            { id: 5, subject: "Drama", location: "York", price: 85, spaces: 5, image: "drama.jpg" },
            { id: 6, subject: "Art", location: "Cambridge", price: 75, spaces: 5, image: "art.jpg" },
            { id: 7, subject: "History", location: "Manchester", price: 88, spaces: 5, image: "history.jpg" },
            { id: 8, subject: "Physics", location: "Bath", price: 98, spaces: 5, image: "physics.jpg" },
            { id: 9, subject: "Chemistry", location: "Liverpool", price: 99, spaces: 5, image: "chemistry.jpg" },
            { id: 10, subject: "Computing", location: "Birmingham", price: 105, spaces: 5, image: "computing.jpg" }
          ];
        });
    },
    addToCart(lesson) {
      if (lesson.spaces > 0) {
        this.cart.push({ ...lesson });
        lesson.spaces--;
      }
    },
    removeFromCart(index) {
      const item = this.cart.splice(index, 1)[0];
      const lesson = this.lessons.find(l => l.id === item.id);
      if (lesson) lesson.spaces++;
    },
    toggleCart() {
      this.showCart = !this.showCart;
      this.errorMsg = '';
      this.successMsg = '';
    },
    canCheckout() {
      const validName = /^[a-zA-Z\s]+$/.test(this.name);
      const validPhone = /^[0-9]{7,}$/.test(this.phone);
      return validName && validPhone && this.cart.length > 0;
    },
    submitOrder() {
      if (!this.canCheckout()) {
        this.errorMsg = "Please enter valid name and phone number.";
        this.successMsg = '';
        return;
      }

      const order = {
        name: this.name,
        phone: this.phone,
        items: this.cart.map(item => ({
          lessonId: item.id,
          subject: item.subject,
          price: item.price
        })),
        total: this.cartTotal
      };

      // Save order then update lesson spaces in the DB
      fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      })
        .then(res => {
          if (!res.ok) throw new Error('Order save failed');
          return res.json();
        })
        .then(() => {
          // build a map of quantities per lesson
          const counts = this.cart.reduce((acc, item) => {
            acc[item.id] = (acc[item.id] || 0) + 1;
            return acc;
          }, {});

          const updatePromises = this.lessons
            .filter(lesson => counts[lesson.id])
            .map(lesson => {
              const newSpace = lesson.spaces;
              return fetch(`/lessons/${lesson.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ space: newSpace })
              });
            });

          return Promise.all(updatePromises);
        })
        .then(() => {
          this.successMsg = "🎉 Order submitted!";
          this.errorMsg = '';
          this.cart = [];
          this.name = '';
          this.phone = '';
        })
        .catch(() => {
          this.errorMsg = "Could not submit order. Please try again.";
          this.successMsg = '';
        });
    }
  },
  mounted() {
    this.loadLessons();
  }
});
