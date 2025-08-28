# SociallyHub Internationalization (i18n) System

## Overview

SociallyHub features a comprehensive internationalization system with automatic translation capabilities powered by AI. The system supports 11 languages with automatic translation for non-English locales, intelligent caching, and database-backed user preferences.

## Features

### ✨ Core Capabilities

- **11 Language Support**: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic
- **Automatic Translation**: AI-powered translations using OpenAI GPT models
- **Intelligent Caching**: Multi-level caching system for translations
- **User Preferences**: Database-backed language preferences per user
- **Workspace Settings**: Default language and supported locales per workspace
- **RTL Support**: Right-to-left layout for Arabic language
- **Context-Aware Translation**: Specialized translations for different UI contexts

### 🧠 AI-Powered Translation

- **OpenAI Integration**: Uses GPT-4o-mini for high-quality translations
- **Batch Processing**: Efficient batch translation for performance
- **Context Preservation**: Maintains technical terms and placeholders
- **Quality Scoring**: Translation quality metrics and tracking
- **Fallback System**: Graceful degradation when translation fails

### 💾 Caching & Performance

- **In-Memory Cache**: Fast access to frequently used translations
- **Database Cache**: Persistent translation storage with expiration
- **Smart Invalidation**: Cache invalidation based on content updates
- **Usage Tracking**: Translation usage analytics and optimization

## Architecture

### Translation Flow

```
User Interface Request
       ↓
useDictionary Hook
       ↓
getDictionary Function
       ↓
Check Cache (Memory)
       ↓
Check Cache (Database) [if miss]
       ↓
AI Translation Service [if miss]
       ↓
Update Caches
       ↓
Return Translation
```

### File Structure

```
src/lib/i18n/
├── config.ts                 # Configuration and supported locales
├── dictionaries/
│   ├── en.json               # Base English dictionary
│   └── [locale].json         # Auto-generated locale files
├── translation-service.ts    # AI translation service
├── get-dictionary.ts         # Dictionary loading and caching
└── index.ts                  # Main exports

src/contexts/
└── locale-context.tsx        # React context for locale state

src/hooks/
└── use-dictionary.ts         # React hook for translations

src/components/ui/
└── language-selector.tsx     # Language selection component

src/app/api/
└── translations/route.ts     # Translation API endpoints
```

## Usage

### Basic Translation

```tsx
import { useDictionary } from '@/hooks/use-dictionary'

function MyComponent() {
  const { t, isLoading } = useDictionary()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h1>{t('dashboard.welcome', 'Welcome to SociallyHub')}</h1>
      <p>{t('dashboard.description', 'Manage your social media accounts')}</p>
    </div>
  )
}
```

### Translation with Variables

```tsx
import { useDictionary } from '@/hooks/use-dictionary'

function PostCounter({ count }: { count: number }) {
  const { tc } = useDictionary()

  return (
    <span>
      {tc('posts.count', { count }, `{count} posts`)}
    </span>
  )
}
```

### Language Selection

```tsx
import { LanguageSelector } from '@/components/ui/language-selector'

function Header() {
  return (
    <div className="header">
      <LanguageSelector variant="compact" />
    </div>
  )
}
```

### HOC for Translation Loading

```tsx
import { withTranslation } from '@/components/providers/translation-provider'

const MyComponent = withTranslation(function MyComponent() {
  const { t } = useDictionary()
  
  return <div>{t('common.loading')}</div>
})
```

## API Endpoints

### POST /api/translations

Translate text or batch of texts:

```typescript
// Single text translation
const response = await fetch('/api/translations', {
  method: 'POST',
  body: JSON.stringify({
    text: 'Hello World',
    targetLanguage: 'es',
    context: 'greeting'
  })
})

// Batch translation
const response = await fetch('/api/translations', {
  method: 'POST',
  body: JSON.stringify({
    texts: ['Hello', 'World', 'Welcome'],
    targetLanguage: 'es',
    context: 'ui'
  })
})
```

### GET /api/translations

Management endpoints:

```typescript
// Get cache statistics
const stats = await fetch('/api/translations?action=cache-stats')

// Clear translation cache
await fetch('/api/translations?action=clear-cache')
```

## Database Schema

### User Language Preferences

```sql
CREATE TABLE "UserLanguagePreference" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "isDefault" BOOLEAN DEFAULT false,
    "proficiency" VARCHAR(20) DEFAULT 'native',
    "autoTranslate" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL
);
```

### Translation Cache

```sql
CREATE TABLE "TranslationCache" (
    "id" TEXT PRIMARY KEY,
    "sourceText" TEXT NOT NULL,
    "sourceLanguage" VARCHAR(5) DEFAULT 'en',
    "targetLanguage" VARCHAR(5) NOT NULL,
    "translatedText" TEXT NOT NULL,
    "context" VARCHAR(100),
    "workspaceId" TEXT,
    "quality" DECIMAL(3,2) DEFAULT 0.95,
    "usageCount" INTEGER DEFAULT 1,
    "expiresAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL
);
```

### Workspace Content Translations

```sql
CREATE TABLE "WorkspaceContentTranslation" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "contentId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "translatedContent" JSONB NOT NULL,
    "isHumanTranslated" BOOLEAN DEFAULT false,
    "translatedBy" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL
);
```

## Configuration

### Environment Variables

```bash
# Required for AI translations
OPENAI_API_KEY=your_openai_api_key_here

# Optional translation service configuration
TRANSLATION_API_URL=https://api.openai.com/v1/chat/completions
```

### Supported Locales

The system supports these locales by default:

- `en` - English (base language)
- `es` - Spanish (Español)
- `fr` - French (Français)  
- `de` - German (Deutsch)
- `it` - Italian (Italiano)
- `pt` - Portuguese (Português)
- `ru` - Russian (Русский)
- `zh` - Chinese (中文)
- `ja` - Japanese (日本語)
- `ko` - Korean (한국어)
- `ar` - Arabic (العربية) - RTL support

## Performance Considerations

### Caching Strategy

1. **Memory Cache**: Fast access to recently used translations
2. **Database Cache**: Persistent storage with 7-day default expiration
3. **Batch Processing**: Groups translation requests for efficiency
4. **Smart Prefetching**: Pre-loads common translations

### Cost Optimization

- **Translation Reuse**: Aggressive caching reduces API calls
- **Batch Processing**: Reduces per-request costs
- **Quality Scoring**: Avoids re-translating high-quality content
- **Usage Analytics**: Identifies translation patterns for optimization

### Performance Metrics

- Cache hit rate: Target >60% for common content
- Translation response time: <2 seconds for single translations
- Batch processing: Up to 50 texts per API call
- Database performance: Indexed queries for fast retrieval

## Development

### Adding New Languages

1. Add locale to `src/lib/i18n/config.ts`:
   ```typescript
   export const locales = [..., 'new-locale'] as const
   export const localeNames = {
     ...existing,
     'new-locale': 'Native Name'
   }
   ```

2. Add RTL support if needed:
   ```typescript
   export const rtlLocales: Locale[] = ['ar', 'new-rtl-locale']
   ```

3. Translation will be automatic via AI service

### Adding New Dictionary Keys

1. Add to `src/lib/i18n/dictionaries/en.json`:
   ```json
   {
     "newSection": {
       "newKey": "English text with {variable} support"
     }
   }
   ```

2. Use in components:
   ```tsx
   const text = t('newSection.newKey', 'Fallback text')
   const withVar = tc('newSection.newKey', { variable: 'value' })
   ```

### Testing Translations

```bash
# Test translation service
npm test src/lib/i18n/__tests__/

# Test UI components with different languages
npm run storybook

# Performance testing
npm run test:performance -- --testNamePattern="translation"
```

## Best Practices

### Translation Keys

- Use descriptive, hierarchical keys: `dashboard.posts.createButton`
- Always provide fallback text for development
- Group related translations by feature/page
- Use consistent naming conventions

### Performance

- Use `useDictionary` hook efficiently - avoid calling `t()` in render loops
- Batch related translations when possible
- Implement loading states for translation-heavy components
- Consider lazy loading for less common languages

### User Experience

- Provide clear loading indicators during translation
- Allow users to switch languages easily
- Maintain UI layout consistency across languages
- Test with RTL languages for proper layout

### Security

- Validate translation input to prevent XSS
- Rate limit translation API calls per user
- Monitor translation costs and usage
- Sanitize user-generated content before translation

## Troubleshooting

### Common Issues

1. **Translations not loading**: Check network requests and API key
2. **Cache issues**: Clear cache via API or restart application
3. **Performance problems**: Check cache hit rates and batch sizes
4. **Missing translations**: Verify dictionary keys and fallbacks
5. **RTL layout issues**: Test with Arabic locale and CSS direction

### Debug Mode

Enable debug logging:

```typescript
// In development
localStorage.setItem('i18n-debug', 'true')

// Check translation service logs
console.log(translationService.getCacheStats())
```

### Monitoring

- Translation API usage and costs
- Cache hit/miss ratios  
- User language preferences
- Translation quality scores
- Performance metrics per locale

## Contributing

When adding features that require translations:

1. Add English keys to the base dictionary
2. Use descriptive, consistent key naming
3. Provide meaningful fallback text
4. Test with multiple languages including RTL
5. Update documentation for new translation patterns

## Future Enhancements

- **Offline Support**: Cache frequently used translations locally
- **Translation Management UI**: Admin interface for translation overrides
- **Quality Feedback**: User rating system for translation quality
- **Custom Models**: Training workspace-specific translation models
- **Voice Translations**: Audio pronunciation for different languages
- **Real-time Collaboration**: Live translation in team environments