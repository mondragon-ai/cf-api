(function () {
    const second = 1000,
      minute = second * 60,
      hour = minute * 60,
      day = hour * 24;

    let today = new Date(),
      days = String(today.getDate()).padStart(2, "0"),
      months = String(today.getMonth() + 1).padStart(2, "0"),
      year = today.getFullYear(),
      nextYear = year + 1,
      dayMonth = "09/30/",
      giveaway = dayMonth + year;
      today = `${months}/${days}/${year}`;

    if (today > giveaway) {
      giveaway = dayMonth + nextYear;
    }

    const countDown = new Date(giveaway).getTime(),
      setTime = setInterval(function () {
        const now = new Date().getTime(),
          distance = countDown - now;
          document.getElementById("days").innerText = Math.floor(distance / (day)),
          document.getElementById("hours").innerText = Math.floor((distance % (day)) / (hour)),
          document.getElementById("minutes").innerText = Math.floor((distance % (hour)) / (minute)),
          document.getElementById("seconds").innerText = Math.floor((distance % (minute)) / (second));
        if (distance < 0) {
          document.getElementById("headline").innerText = "Giveaway ended!";
          document.getElementById("countdown").style.display = "none";
          document.getElementById("content").style.display = "block";
          clearInterval(setTime);
        }
      }, 0)
  }());