import { defineType, defineField } from 'sanity'

export const room = defineType({
  name: 'room',
  title: 'Room',
  type: 'document',
  fields: [
    defineField({
      name: 'locationLabel',
      title: 'Location Label (for easy identification in list)',
      type: 'string',
      description: 'Example: Billionaire’s Den - King of Prussia',
    }),
    defineField({
      name: 'title',
      title: 'Room Title (public name)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle / Tagline (optional)',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'reference',
      to: [{ type: 'location' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'difficulty',
      title: 'Difficulty',
      type: 'string',
      options: {
        list: ['Easy', 'Medium', 'Hard', 'Expert'],
      },
    }),
    defineField({
      name: 'duration',
      title: 'Duration',
      type: 'number',
      initialValue: 60,
    }),
    defineField({
      name: 'price',
      title: 'Price per Person',
      type: 'number',
      initialValue: 32,
    }),
    defineField({
      name: 'description',
      title: 'Short Description',
      type: 'text',
    }),
    defineField({
      name: 'story',
      title: 'Room Story / Plot',
      type: 'text',
    }),
    defineField({
      name: 'minPlayers',
      title: 'Min Players',
      type: 'number',
    }),
    defineField({
      name: 'maxPlayers',
      title: 'Max Players',
      type: 'number',
    }),
    {
      name: 'bookeoTypeWeekday',
      title: 'Bookeo Type - Weekday',
      type: 'string',
      description: 'Paste the type code for the regular/weekday version',
    },
    {
      name: 'bookeoTypeSaturday',
      title: 'Bookeo Type - Saturday',
      type: 'string',
      description: 'Paste the type code for the Saturday version',
    },
  ],

  preview: {
    select: {
      title: 'title',
      locationLabel: 'locationLabel',
    },
    prepare({ title, locationLabel }) {
      return {
        title: locationLabel || title,
        subtitle: locationLabel ? title : '',
      }
    },
  },
})