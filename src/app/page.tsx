import Link from "next/link"
import { ArrowRight, CheckCircle, Star, MessageCircle, Calendar, BarChart3, Users, PenTool, Shield, Zap, Target, Globe, TrendingUp, Clock, Award, PlayCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function LandingPage() {
  const features = [
    {
      icon: MessageCircle,
      title: "Unified Social Inbox",
      description: "Never miss a customer interaction. Manage all comments, messages, and mentions from every platform in one intelligent dashboard.",
      benefit: "Save 15+ hours per week"
    },
    {
      icon: Calendar,
      title: "AI-Powered Scheduling",
      description: "Our smart algorithm finds the perfect time to post for maximum engagement across all your social platforms.",
      benefit: "Increase reach by 3x"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Get actionable insights with detailed performance metrics, competitor analysis, and ROI tracking.",
      benefit: "Boost engagement by 150%"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Streamline your workflow with approval processes, content calendars, and role-based permissions.",
      benefit: "Scale your team effortlessly"
    },
    {
      icon: PenTool,
      title: "Content Creation Suite",
      description: "Built-in design tools, templates, and AI writing assistant to create scroll-stopping content in minutes.",
      benefit: "Create content 5x faster"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level security with SOC2 compliance, advanced permissions, and audit trails for peace of mind.",
      benefit: "100% secure & compliant"
    }
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director",
      company: "TechFlow Inc",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face",
      content: "SociallyHub transformed our social media strategy. We went from chaos to a well-oiled machine that drives real business results. ROI increased by 340% in just 3 months.",
      rating: 5,
      results: "340% ROI increase"
    },
    {
      name: "Marcus Johnson", 
      role: "Social Media Manager",
      company: "Creative Studios",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      content: "The AI scheduling feature is a game-changer. Our engagement rates skyrocketed because we're now posting at optimal times across all platforms automatically.",
      rating: 5,
      results: "250% more engagement"
    },
    {
      name: "Emily Rodriguez",
      role: "CEO & Founder",
      company: "GrowthCo", 
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      content: "As a startup, we needed enterprise-level tools without the enterprise budget. SociallyHub delivered exactly that. Now we compete with companies 10x our size.",
      rating: 5,
      results: "10x competitive advantage"
    }
  ]

  const pricingPlans = [
    {
      name: "Starter",
      price: "$29",
      period: "per month",
      description: "Perfect for solo entrepreneurs and small businesses",
      originalPrice: "$49",
      discount: "40% OFF",
      features: [
        "3 social media accounts",
        "100 scheduled posts/month", 
        "Basic analytics dashboard",
        "Email support",
        "Content calendar",
        "1 user license"
      ],
      popular: false,
      cta: "Start Free Trial",
      highlight: "Most Affordable"
    },
    {
      name: "Professional", 
      price: "$79",
      period: "per month",
      description: "Ideal for growing businesses and marketing teams",
      originalPrice: "$129",
      discount: "40% OFF",
      features: [
        "10 social media accounts",
        "Unlimited scheduled posts",
        "Advanced analytics & reports", 
        "Team collaboration (5 users)",
        "Priority support",
        "Custom branding",
        "API access",
        "A/B testing",
        "Competitor analysis"
      ],
      popular: true,
      cta: "Start Free Trial",
      highlight: "Most Popular"
    },
    {
      name: "Enterprise",
      price: "$199", 
      period: "per month",
      description: "For agencies and large teams with advanced needs",
      originalPrice: "$299",
      discount: "35% OFF",
      features: [
        "Unlimited social accounts",
        "Unlimited team members",
        "White-label solution",
        "Advanced integrations",
        "Dedicated account manager", 
        "Custom reporting",
        "SLA guarantee",
        "SSO & advanced security",
        "Custom workflows",
        "24/7 phone support"
      ],
      popular: false,
      cta: "Contact Sales",
      highlight: "Most Powerful"
    }
  ]

  const stats = [
    { value: "50,000+", label: "Happy Customers", subtext: "Growing daily" },
    { value: "2.5M+", label: "Posts Managed", subtext: "This month alone" }, 
    { value: "99.99%", label: "Uptime SLA", subtext: "Guaranteed" },
    { value: "24/7", label: "Expert Support", subtext: "Always here" }
  ]

  const trustedByLogos = [
    { name: "TechCorp", logo: "TC" },
    { name: "Innovation Labs", logo: "IL" },
    { name: "Digital Agency", logo: "DA" },
    { name: "Growth Co", logo: "GC" },
    { name: "Creative Studio", logo: "CS" },
    { name: "StartupXYZ", logo: "SX" }
  ]

  const benefits = [
    "✅ 14-day free trial, no credit card required",
    "✅ Cancel anytime, no hidden fees",
    "✅ Free migration from any platform",
    "✅ 24/7 customer success support",
    "✅ 99.99% uptime guarantee"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-xl border-b border-border/50 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                SociallyHub
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Reviews
              </Link>
              <Link href="/auth/signin">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-600/5"></div>
        <div className="absolute top-1/4 -right-64 w-96 h-96 bg-gradient-to-l from-primary/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -top-32 -left-64 w-96 h-96 bg-gradient-to-r from-blue-600/10 to-transparent rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Badge className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-700 border-green-200 px-4 py-2">
                    <Zap className="h-3 w-3 mr-1" />
                    #1 Social Media Management Platform
                  </Badge>
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="text-foreground">Transform Your</span><br />
                  <span className="bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Social Media Success
                  </span><br />
                  <span className="text-foreground">in 30 Days</span>
                </h1>
                
                <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                  Join 50,000+ businesses using AI-powered social media management to 
                  <strong className="text-foreground"> increase engagement by 250%</strong> and 
                  <strong className="text-foreground"> save 20+ hours per week</strong>.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/signup">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg shadow-primary/25 px-8">
                    Start Free 14-Day Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-2 px-8">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Watch 2-Min Demo
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
                    <div className="text-xs text-muted-foreground/70">{stat.subtext}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 via-blue-600/20 to-purple-600/20 rounded-3xl blur-2xl opacity-60"></div>
              <Card className="relative bg-gradient-to-br from-background via-background to-muted/20 border-2 border-border/50 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-blue-600/5 p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Live Analytics Dashboard</h3>
                      <p className="text-sm text-muted-foreground">Real-time performance insights</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Engagement Rate</span>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-lg font-bold text-green-600">+347%</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full shadow-lg" style={{width: '87%'}}></div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="bg-background/50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-foreground">156K</div>
                        <div className="text-xs text-muted-foreground">Total Reach</div>
                      </div>
                      <div className="bg-background/50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-foreground">12.4K</div>
                        <div className="text-xs text-muted-foreground">Engagements</div>
                      </div>
                      <div className="bg-background/50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-foreground">2.8K</div>
                        <div className="text-xs text-muted-foreground">New Followers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-muted-foreground mb-8">TRUSTED BY 50,000+ COMPANIES WORLDWIDE</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {trustedByLogos.map((company, index) => (
                <div key={index} className="flex items-center space-x-2 text-muted-foreground">
                  <div className="h-8 w-8 bg-muted-foreground/20 rounded-lg flex items-center justify-center text-xs font-bold">
                    {company.logo}
                  </div>
                  <span className="text-sm font-medium">{company.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/10"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center space-y-4 mb-20">
            <Badge className="bg-primary/10 text-primary px-4 py-2 mb-4">
              <Target className="h-3 w-3 mr-1" />
              POWERFUL FEATURES
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
              Everything You Need to
              <span className="block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Dominate Social Media
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our all-in-one platform combines AI intelligence with proven marketing strategies 
              to help you create, schedule, and analyze content that drives real business results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <feature.icon className="h-7 w-7 text-primary" />
                      </div>
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                        {feature.benefit}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center text-primary text-sm font-medium group-hover:underline">
                      Learn more <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-muted/20 via-background to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-green-500/10 text-green-700 border-green-200 px-4 py-2 mb-4">
              <Award className="h-3 w-3 mr-1" />
              SUCCESS STORIES
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
              Join Thousands of
              <span className="block bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Successful Businesses
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See how companies like yours are achieving incredible results with SociallyHub
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="relative bg-background border-2 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent"></div>
                <CardContent className="p-8 relative">
                  <div className="space-y-6">
                    <div className="flex space-x-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    
                    <blockquote className="text-foreground italic leading-relaxed">
                      "{testimonial.content}"
                    </blockquote>
                    
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-foreground">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {testimonial.role} at {testimonial.company}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-3 mt-4">
                      <div className="text-sm font-bold text-green-700">
                        {testimonial.results}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/20"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-primary/10 text-primary px-4 py-2 mb-4">
              <Clock className="h-3 w-3 mr-1" />
              LIMITED TIME OFFER
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
              Simple, Transparent Pricing
              <span className="block text-2xl sm:text-3xl text-muted-foreground mt-2">
                Save up to 40% - No Setup Fees
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index}
                className={`relative hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 overflow-hidden ${
                  plan.popular 
                    ? 'border-primary shadow-xl shadow-primary/20 scale-105' 
                    : 'border-border/50 hover:border-primary/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-blue-600 text-white text-center py-2 text-sm font-bold">
                    {plan.highlight} - {plan.discount}
                  </div>
                )}
                
                <CardContent className={`p-8 ${plan.popular ? 'pt-16' : 'pt-8'}`}>
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="mb-4">
                        <Badge variant="outline" className="text-xs">
                          {plan.highlight}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                          <div className="text-left">
                            <div className="text-sm text-muted-foreground">/{plan.period}</div>
                            <div className="text-xs line-through text-muted-foreground">{plan.originalPrice}</div>
                          </div>
                        </div>
                        {plan.discount && (
                          <Badge className="bg-red-500/10 text-red-700 border-red-200">
                            {plan.discount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-4">{plan.description}</p>
                    </div>

                    <div className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="text-foreground text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/auth/signup" className="block">
                      <Button 
                        className={`w-full text-base py-6 ${
                          plan.popular 
                            ? 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg shadow-primary/25' 
                            : ''
                        }`}
                        variant={plan.popular ? "default" : "outline"}
                        size="lg"
                      >
                        {plan.cta}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Benefits */}
          <div className="mt-16 bg-gradient-to-r from-primary/5 to-blue-600/5 rounded-2xl p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="text-sm text-muted-foreground">
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary via-blue-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-1/4 -right-32 w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-16 -left-32 w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Ready to Transform Your
            <span className="block">Social Media Success?</span>
          </h2>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Join 50,000+ businesses already using SociallyHub to streamline their social media management, 
            increase engagement, and drive real business growth.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-primary hover:bg-white/95 shadow-xl px-8 text-lg py-6 w-full sm:w-auto">
                Start Your Free 14-Day Trial
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="border-2 border-white text-white hover:bg-white/10 px-8 text-lg py-6 w-full sm:w-auto">
              <PlayCircle className="mr-2 h-6 w-6" />
              Watch Demo
            </Button>
          </div>
          
          <div className="pt-8 text-white/80 text-sm">
            <p>✨ No credit card required • ✨ Cancel anytime • ✨ 24/7 support</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  SociallyHub
                </span>
              </div>
              <p className="text-muted-foreground max-w-md">
                The world's #1 social media management platform. Trusted by 50,000+ businesses 
                to grow their social media presence and drive real business results.
              </p>
              <div className="flex space-x-2">
                <Badge variant="secondary">SOC2 Certified</Badge>
                <Badge variant="secondary">GDPR Compliant</Badge>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-foreground mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link href="#integrations" className="hover:text-foreground transition-colors">Integrations</Link></li>
                <li><Link href="#api" className="hover:text-foreground transition-colors">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-foreground mb-4">Company</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link href="#careers" className="hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link href="#press" className="hover:text-foreground transition-colors">Press</Link></li>
                <li><Link href="#blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-foreground mb-4">Support</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#help" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link href="#docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link href="#community" className="hover:text-foreground transition-colors">Community</Link></li>
                <li><Link href="#status" className="hover:text-foreground transition-colors">System Status</Link></li>
                <li><Link href="#security" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-16 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2024 SociallyHub. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 sm:mt-0 text-sm text-muted-foreground">
              <Link href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="#terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <Link href="#cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}