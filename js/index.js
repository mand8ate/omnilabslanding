// style changes
const elements = Array.from(document.querySelectorAll(".card-link"));
const elementsToChange = Array.from(document.querySelectorAll(".li-change"));

console.log(elements, elementsToChange);

elements.forEach((element, i) => {
  element.addEventListener("mouseover", () => {
    elementsToChange[i].style.background = "#EA7F72";
  });

  element.addEventListener("mouseout", () => {
    elementsToChange[i].style.background = "#e96d5e";
  });
});

// animations
gsap.registerPlugin(ScrollTrigger);
const tl = gsap.timeline();

tl.from(".content", {
  y: "-30%",
  opacity: 0,
  duration: 2,
  ease: Power4.easeOut,
});
tl.from(
  ".stagger1",
  {
    opacity: 0,
    y: -50,
    stagger: 0.3,
    duration: 2,
    ease: Power4.easeOut,
  },
  "-=1.5"
);
tl.from(
  ".hero-graphic",
  {
    opacity: 0,
    y: 50,
    ease: Power4.easeOut,
    duration: 1,
  },
  "-=2.5"
);

gsap.from(".hero-anim", {
  stagger: 0.1,
  scale: 0.1,
  opacity: 0,
  duration: 0.5,
  ease: Back.easeOut.config(1.7),
});

const animate1 = (element) => {
  gsap.from(element, {
    scrollTrigger: {
      trigger: element,
      start: "top bottom",
    },
    y: 50,
    opacity: 0,
    duration: 1.2,
    stagger: 0.3,
  });
};

animate1(".transition1");
animate1(".transition1-content");
animate1(".transition2");
animate1(".transition3");
animate1(".transition3-mobile");
animate1(".transition4");
animate1(".transition5");
animate1(".transition6");
animate1(".transition7");
animate1(".transition7-mobile");
animate1(".transition8");
animate1(".transition9");

// navbar
const body = document.body;
let lastScroll = 0;

window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;
  if (currentScroll <= 0) {
    body.classList.remove("scrollUp");
    return;
  }

  if (currentScroll > lastScroll && !body.classList.contains("scrollDown")) {
    body.classList.remove("scrollUp");
    body.classList.add("scrollDown");
  } else if (
    currentScroll < lastScroll &&
    body.classList.contains("scrollDown")
  ) {
    body.classList.remove("scrollDown");
    body.classList.add("scrollUp");
  }

  lastScroll = currentScroll;
});
