const CACHE_KEY = 'quotes_cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

const QUOTES = [
    // Steve Jobs
    { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { content: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    { content: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { content: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { content: "Design is not just what it looks like and feels like. Design is how it works.", author: "Steve Jobs" },
    { content: "Be a yardstick of quality. Some people aren't used to an environment where excellence is expected.", author: "Steve Jobs" },
    { content: "Simple can be harder than complex. You have to work hard to get your thinking clean to make it simple.", author: "Steve Jobs" },
    { content: "Have the courage to follow your heart and intuition.", author: "Steve Jobs" },
    { content: "Quality is more important than quantity. One home run is much better than two doubles.", author: "Steve Jobs" },
    // Paul Graham
    { content: "It's hard to do a really good job on anything you don't think about in the shower.", author: "Paul Graham" },
    { content: "The way to get startup ideas is not to try to think of startup ideas.", author: "Paul Graham" },
    { content: "Make something people want.", author: "Paul Graham" },
    { content: "Live in the future, then build what's missing.", author: "Paul Graham" },
    { content: "The best way to predict the future is to create it.", author: "Paul Graham" },
    { content: "Do things that don't scale.", author: "Paul Graham" },
    // Elon Musk
    { content: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk" },
    { content: "Failure is an option here. If things are not failing, you are not innovating enough.", author: "Elon Musk" },
    { content: "I think it's possible for ordinary people to choose to be extraordinary.", author: "Elon Musk" },
    { content: "Constantly think about how you could be doing things better.", author: "Elon Musk" },
    // Marc Andreessen
    { content: "Software is eating the world.", author: "Marc Andreessen" },
    { content: "The best way to understand entrepreneurship is to do it.", author: "Marc Andreessen" },
    { content: "In a fight between a bear and an alligator, it's the terrain that determines the winner.", author: "Marc Andreessen" },
    // Sam Altman
    { content: "Great execution is at least 10 times more important than a great idea.", author: "Sam Altman" },
    { content: "Work on something that matters to you more than money.", author: "Sam Altman" },
    { content: "Move fast. Speed is one of your main advantages over large companies.", author: "Sam Altman" },
    // Peter Thiel
    { content: "Competition is for losers.", author: "Peter Thiel" },
    { content: "What important truth do very few people agree with you on?", author: "Peter Thiel" },
    { content: "Brilliant thinking is rare, but courage is in even shorter supply.", author: "Peter Thiel" },
    // Jeff Bezos
    { content: "If you double the number of experiments you do per year, you're going to double your inventiveness.", author: "Jeff Bezos" },
    { content: "Your brand is what people say about you when you're not in the room.", author: "Jeff Bezos" },
    { content: "Work hard, have fun, make history.", author: "Jeff Bezos" },
    // Others
    { content: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg" },
    { content: "Ideas are easy. Implementation is hard.", author: "Guy Kawasaki" },
    { content: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" },
    { content: "If you're not embarrassed by the first version of your product, you've launched too late.", author: "Reid Hoffman" },
    { content: "Done is better than perfect.", author: "Sheryl Sandberg" },
    { content: "The best minds of my generation are thinking about how to make people click ads.", author: "Jeff Hammerbacher" },
    // Naval Ravikant
    { content: "Play long-term games with long-term people.", author: "Naval Ravikant" },
    { content: "Seek wealth, not money or status.", author: "Naval Ravikant" },
    { content: "Earn with your mind, not your time.", author: "Naval Ravikant" },
    { content: "A fit body, a calm mind, a house full of love. These things cannot be bought.", author: "Naval Ravikant" },
    { content: "Reading is faster than listening. Doing is faster than watching.", author: "Naval Ravikant" },
    // Reid Hoffman
    { content: "An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.", author: "Reid Hoffman" },
    { content: "No matter how brilliant your mind or strategy, if you're playing a solo game, you'll always lose out to a team.", author: "Reid Hoffman" },
    // Jensen Huang
    { content: "I don't like giving up on people. Resilience matters in success.", author: "Jensen Huang" },
    { content: "Pain and suffering, while you're going through it, builds character.", author: "Jensen Huang" },
    // Drew Houston
    { content: "Don't worry about failure; you only have to be right once.", author: "Drew Houston" },
    // Tobi Lütke
    { content: "Building a company is one of the most aggressive forms of personal development out there.", author: "Tobi Lütke" },
    // Patrick Collison
    { content: "Optimism is a force multiplier.", author: "Patrick Collison" },
    { content: "You can just do things.", author: "Patrick Collison" },
    // Linus Torvalds
    { content: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { content: "Given enough eyeballs, all bugs are shallow.", author: "Linus Torvalds" },
    // Engineering wisdom
    { content: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
    { content: "There are only two hard things in computer science: cache invalidation and naming things.", author: "Phil Karlton" },
    { content: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
    { content: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { content: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { content: "Make it work, make it right, make it fast.", author: "Kent Beck" },
    { content: "The best code is no code at all.", author: "Jeff Atwood" },
    { content: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
    { content: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupéry" },
    // Timeless
    { content: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
    { content: "The only thing we have to fear is fear itself.", author: "Franklin D. Roosevelt" },
    { content: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { content: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { content: "Discipline equals freedom.", author: "Jocko Willink" },
    { content: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
    { content: "What you do speaks so loudly that I cannot hear what you say.", author: "Ralph Waldo Emerson" },
    { content: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
]

export class QuotesAPI {
    getCachedQuote() {
        try {
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                const { quote, timestamp } = JSON.parse(cached)
                const isStale = Date.now() - timestamp > CACHE_DURATION
                return { quote, isStale }
            }
        } catch (error) {
            console.error('failed to get cached quote:', error)
        }
        return { quote: null, isStale: true }
    }

    cacheQuote(quote) {
        try {
            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    quote,
                    timestamp: Date.now(),
                })
            )
        } catch (error) {
            console.error('failed to cache quote:', error)
        }
    }

    clearCache() {
        localStorage.removeItem(CACHE_KEY)
    }

    getRandomQuote() {
        const index = Math.floor(Math.random() * QUOTES.length)
        return QUOTES[index]
    }

    async getQuote() {
        // Check cache first
        const { quote: cachedQuote, isStale } = this.getCachedQuote()

        if (cachedQuote && !isStale) {
            return cachedQuote
        }

        // Get a new random quote
        const quote = this.getRandomQuote()
        this.cacheQuote(quote)
        return quote
    }
}

export default QuotesAPI
