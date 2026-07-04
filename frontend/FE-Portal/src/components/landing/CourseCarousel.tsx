import { motion } from "framer-motion";
import { Star, Clock, BarChart3, Users } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper/modules";
import { courses } from "@/constants/landingData";
import { FadeInView } from "./shared/FadeInView";
import { ShineButton } from "./shared/ShineButton";
import { Link } from "react-router-dom";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export const CourseCarousel = () => (
  <section id="courses" className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeInView className="mb-14">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tight mb-5">
          Cloud, Data Warehouse & Modern Data Engineering
        </h2>
        <p className="text-zinc-500 text-base sm:text-lg leading-relaxed">
          Gain practical knowledge of modern cloud and data warehouse technologies including AWS, Snowflake, Amazon Redshift, and enterprise data platforms used for scalable analytics and big data processing.
        </p>
      </FadeInView>

      <FadeInView delay={0.1}>
        <Swiper
          modules={[Pagination, Navigation]}
          spaceBetween={24}
          slidesPerView={1.12}
          pagination={{ clickable: true }}
          // navigation
          breakpoints={{
            640: { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 24 },
            1280: { slidesPerView: 4, spaceBetween: 24 },
          }}
          className="course-swiper pb-14"
        >
          {courses.map((course) => (
            <SwiperSlide key={course.id} className="!h-auto">
              <motion.article
                whileHover={{ scale: 1.03, y: -6 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="bg-white rounded-3xl border border-zinc-200/90 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-12px_rgba(109,40,217,0.18)] h-full flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-full h-full rounded-3xl object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-5 sm:p-6 flex flex-col flex-1 gap-3">
                  <span className="inline-block text-xs font-regular text-[#3D065F] bg-[#EAC2FF] border border-[#EAC2FF] px-3 py-1 rounded-full w-fit">
                    {course.tag}
                  </span>
                  {/* <h3 className="font-bold text-zinc-900 text-base tracking-tight line-clamp-1">
                    {course.title}
                  </h3> */}
                  <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3 flex-1">
                    {course.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 pt-4 border-t border-zinc-100">
                    <span className="flex flex-col items-center gap-1 font-medium">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      {course.rating} ({course.students.replace("+", "")})
                    </span>
                    {/* <span className="flex flex-col items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-violet-500" />
                      {course.students}
                    </span> */}
                    <span className="flex flex-col items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      {course.hours}
                    </span>
                    <span className="flex flex-col items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
                      {course.level}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold border border-zinc-200 text-zinc-700 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-800 transition-colors"
                  >
                    View course
                  </button>
                </div>
              </motion.article>
            </SwiperSlide>
          ))}
        </Swiper>
      </FadeInView>

      <FadeInView delay={0.2} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14">
        <Link to="/login" state={{ role: "candidate" }} className="w-full sm:w-auto">
          <ShineButton className="w-full sm:min-w-[200px]">Browse all courses</ShineButton>
        </Link>
        <Link
          to="/login"
          state={{ role: "candidate", defaultTab: "signup" }}
          className="w-full sm:w-auto"
        >
          <ShineButton variant="secondary" className="w-full sm:min-w-[200px]">
            Start learning
          </ShineButton>
        </Link>
      </FadeInView>
    </div>
  </section>
);
