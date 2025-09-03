"use client"

import Link from "next/link"
import { ArrowRight, Users, Target, Zap, Globe, Award, TrendingUp, Heart, Star } from "lucide-react"
import { MaterialButton } from "@/components/ui/material-button"
import { MaterialCard, MaterialCardContent } from "@/components/ui/material-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function AboutPage() {
  const team = [
    {
      name: "Alex Thompson",
      role: "CEO & Co-Founder",
      avatar: "AT",
      bio: "Former Twitter product lead with 10+ years in social media. Built 3 successful startups.",
      expertise: "Product Strategy, Social Media"
    },
    {
      name: "Sarah Kim",
      role: "CTO & Co-Founder", 
      avatar: "SK",
      bio: "Ex-Facebook engineer. Led platform teams at scale. PhD in Computer Science from MIT.",
      expertise: "Engineering, Architecture"
    },
    {
      name: "Marcus Rodriguez",
      role: "Head of Design",
      avatar: "MR",
      bio: "Award-winning designer from Google. Passionate about creating intuitive experiences.",
      expertise: "UX/UI Design, User Research"
    },
    {
      name: "Emily Chen",
      role: "VP of Marketing",
      avatar: "EC",
      bio: "Growth marketing expert. Helped 50+ companies scale their social media presence.",
      expertise: "Growth Marketing, Analytics"
    },
    {
      name: "David Wilson",
      role: "Head of Engineering",
      avatar: "DW",
      bio: "Infrastructure expert from Amazon. Loves building scalable, reliable systems.",
      expertise: "Backend, Infrastructure"
    },
    {
      name: "Lisa Park",
      role: "Customer Success Lead",
      avatar: "LP",
      bio: "Customer advocate with deep experience in SaaS and social media management.",
      expertise: "Customer Success, Support"
    }
  ]

  const values = [
    {
      icon: Users,
      title: "Customer First",
      description: "Every decision starts with understanding and serving our customers' needs.",
      color: "text-md-primary"
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "We constantly push boundaries to create the future of social media management.",
      color: "text-md-secondary"
    },
    {
      icon: Heart,
      title: "Transparency",
      description: "Open communication, honest feedback, and clear pricing - always.",
      color: "text-md-tertiary"
    },
    {
      icon: Target,
      title: "Excellence",
      description: "We strive for the highest quality in everything we build and deliver.",
      color: "text-md-primary"
    }
  ]

  const milestones = [
    {
      year: "2020",
      title: "Company Founded",
      description: "Started with a vision to simplify social media management for everyone."
    },
    {
      year: "2021",
      title: "First 1,000 Users",
      description: "Reached our first milestone with amazing customer feedback and testimonials."
    },
    {
      year: "2022",
      title: "$5M Series A",
      description: "Raised Series A funding to accelerate product development and team growth."
    },
    {
      year: "2023",
      title: "50,000+ Users",
      description: "Expanded globally and reached 50,000 active users across 100+ countries."
    },
    {
      year: "2024",
      title: "AI Integration",
      description: "Launched AI-powered features for content optimization and smart scheduling."
    }
  ]

  const stats = [
    { value: "50K+", label: "Happy Customers", icon: Users },
    { value: "2M+", label: "Posts Managed", icon: TrendingUp },
    { value: "100+", label: "Countries", icon: Globe },
    { value: "99.9%", label: "Uptime", icon: Award }
  ]

  return (
    <div className="min-h-screen bg-md-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-md-surface-container/95 backdrop-blur-md border-b border-md-outline-variant/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-md-small bg-md-primary"></div>
              <span className="text-headline-small font-medium text-md-on-surface">SociallyHub</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/#features" className="text-body-medium text-md-on-surface-variant hover:text-md-on-surface transition-colors">
                Features
              </Link>
              <Link href="/#pricing" className="text-body-medium text-md-on-surface-variant hover:text-md-on-surface transition-colors">
                Pricing
              </Link>
              <Link href="/about" className="text-body-medium text-md-on-surface font-medium">
                About
              </Link>
              <Link href="/auth/signin">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <MaterialButton variant="filled">Get Started</MaterialButton>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-8 animate-fade-in">
            <Badge className="bg-md-primary-container text-md-on-primary-container px-4 py-2 rounded-md-full">
              🚀 Building the future of social media management
            </Badge>
            <h1 className="text-display-large font-normal text-md-on-background leading-tight max-w-4xl mx-auto">
              We're on a Mission to 
              <span className="text-md-primary"> Simplify</span> Social Media
            </h1>
            <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
              Founded by social media veterans, SociallyHub was created to solve the real challenges 
              businesses face in managing their online presence. We believe social media management 
              should be powerful yet simple.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <MaterialButton variant="filled" size="lg">
                  Join Our Mission
                  <ArrowRight className="ml-2 h-5 w-5" />
                </MaterialButton>
              </Link>
              <Link href="#team">
                <MaterialButton variant="outlined" size="lg">
                  Meet the Team
                </MaterialButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-md-surface-variant/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="animate-scale-in" style={{animationDelay: `${index * 100}ms`}}>
                <MaterialCard className="p-8 space-y-4">
                  <div className="h-12 w-12 rounded-md-medium bg-md-primary-container mx-auto flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-md-on-primary-container" />
                  </div>
                  <div className="text-display-medium font-normal text-md-on-surface">{stat.value}</div>
                  <div className="text-body-medium text-md-on-surface-variant">{stat.label}</div>
                </MaterialCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-display-small font-normal text-md-on-background mb-6">
                  Our Story
                </h2>
                <div className="space-y-4 text-body-large text-md-on-surface-variant">
                  <p>
                    SociallyHub was born from frustration. As social media managers at various companies, 
                    our founders spent countless hours jumping between different tools, struggling with 
                    inconsistent interfaces, and dealing with platforms that didn't talk to each other.
                  </p>
                  <p>
                    In 2020, we decided to build the solution we wished existed - a unified platform 
                    that would make social media management not just easier, but genuinely enjoyable.
                  </p>
                  <p>
                    Today, we're proud to serve over 50,000 businesses worldwide, helping them save time, 
                    increase engagement, and grow their online presence.
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-slide-up" style={{animationDelay: '200ms'}}>
              <div className="space-y-6">
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex space-x-4 animate-fade-in" style={{animationDelay: `${300 + index * 100}ms`}}>
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-md-full bg-md-primary-container flex items-center justify-center">
                        <span className="text-label-large font-medium text-md-on-primary-container">
                          {milestone.year.slice(-2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-title-large font-medium text-md-on-surface">
                        {milestone.title}
                      </h3>
                      <p className="text-body-medium text-md-on-surface-variant mt-1">
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-md-surface-variant/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16 animate-fade-in">
            <h2 className="text-display-small font-normal text-md-on-background">
              Our Values
            </h2>
            <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
              The principles that guide everything we do and every decision we make.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <MaterialCard 
                key={index} 
                className="animate-slide-up text-center" 
                style={{animationDelay: `${index * 100}ms`}}
              >
                <MaterialCardContent className="p-8 space-y-4">
                  <div className="h-16 w-16 rounded-md-large bg-md-primary-container/20 mx-auto flex items-center justify-center">
                    <value.icon className={`h-8 w-8 ${value.color}`} />
                  </div>
                  <h3 className="text-title-large font-medium text-md-on-surface">{value.title}</h3>
                  <p className="text-body-medium text-md-on-surface-variant">{value.description}</p>
                </MaterialCardContent>
              </MaterialCard>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16 animate-fade-in">
            <h2 className="text-display-small font-normal text-md-on-background">
              Meet Our Team
            </h2>
            <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
              The passionate people behind SociallyHub who work every day to make social media management better.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <MaterialCard 
                key={index} 
                className="animate-scale-in" 
                style={{animationDelay: `${index * 100}ms`}}
              >
                <MaterialCardContent className="p-8 text-center space-y-4">
                  <div className="h-20 w-20 rounded-md-full bg-md-primary-container mx-auto flex items-center justify-center">
                    <span className="text-headline-small font-medium text-md-on-primary-container">
                      {member.avatar}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-title-large font-medium text-md-on-surface">{member.name}</h3>
                    <p className="text-title-medium text-md-primary">{member.role}</p>
                  </div>
                  <p className="text-body-medium text-md-on-surface-variant">{member.bio}</p>
                  <Badge className="bg-md-secondary-container text-md-on-secondary-container text-label-small">
                    {member.expertise}
                  </Badge>
                </MaterialCardContent>
              </MaterialCard>
            ))}
          </div>
        </div>
      </section>

      {/* Join Us Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-md-surface-variant/30">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <h2 className="text-display-small font-normal text-md-on-background">
            Want to Join Our Mission?
          </h2>
          <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
            We're always looking for talented, passionate people to join our team. 
            If you're excited about the future of social media, we'd love to hear from you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="#careers">
              <MaterialButton variant="filled" size="lg" className="px-8">
                View Open Positions
                <ArrowRight className="ml-2 h-5 w-5" />
              </MaterialButton>
            </Link>
            <Link href="#contact">
              <MaterialButton variant="outlined" size="lg" className="px-8">
                Get in Touch
              </MaterialButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-md-surface-container border-t border-md-outline-variant/20 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-md-small bg-md-primary"></div>
                <span className="text-headline-small font-medium text-md-on-surface">SociallyHub</span>
              </div>
              <p className="text-body-medium text-md-on-surface-variant">
                The complete social media management platform for modern businesses.
              </p>
            </div>
            
            <div>
              <h3 className="text-title-medium font-medium text-md-on-surface mb-4">Product</h3>
              <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
                <li><Link href="/#features" className="hover:text-md-on-surface transition-colors">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-md-on-surface transition-colors">Pricing</Link></li>
                <li><Link href="/dashboard" className="hover:text-md-on-surface transition-colors">Dashboard</Link></li>
                <li><Link href="#integrations" className="hover:text-md-on-surface transition-colors">Integrations</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-title-medium font-medium text-md-on-surface mb-4">Company</h3>
              <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
                <li><Link href="/about" className="hover:text-md-on-surface transition-colors">About</Link></li>
                <li><Link href="#careers" className="hover:text-md-on-surface transition-colors">Careers</Link></li>
                <li><Link href="#contact" className="hover:text-md-on-surface transition-colors">Contact</Link></li>
                <li><Link href="#blog" className="hover:text-md-on-surface transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-title-medium font-medium text-md-on-surface mb-4">Support</h3>
              <ul className="space-y-2 text-body-medium text-md-on-surface-variant">
                <li><Link href="#help" className="hover:text-md-on-surface transition-colors">Help Center</Link></li>
                <li><Link href="#docs" className="hover:text-md-on-surface transition-colors">Documentation</Link></li>
                <li><Link href="#status" className="hover:text-md-on-surface transition-colors">Status</Link></li>
                <li><Link href="#security" className="hover:text-md-on-surface transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-md-outline-variant/20 mt-12 pt-8 text-center">
            <p className="text-body-medium text-md-on-surface-variant">
              © 2024 SociallyHub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}